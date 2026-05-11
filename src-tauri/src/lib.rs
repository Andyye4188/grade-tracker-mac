use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

struct AppState { db: Mutex<Connection> }

#[derive(Debug, Serialize, Deserialize)]
pub struct Score {
    pub id: Option<i64>,
    pub subject: String,
    pub score: f64,
    pub possible: f64,
    pub score_type: String,
    pub date: String,
    pub note: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Goal {
    pub id: Option<i64>,
    pub subject: String,
    pub goal: f64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ScoreRow {
    score: f64,
    possible: f64,
    score_type: String,
}

fn calc_weighted_avg(scores: &[ScoreRow]) -> (f64, f64, f64, f64) {
    let mut major_score_sum = 0.0;
    let mut major_possible_sum = 0.0;
    let mut minor_score_sum = 0.0;
    let mut minor_possible_sum = 0.0;

    for s in scores {
        if s.score_type == "Major" {
            major_score_sum += s.score;
            major_possible_sum += s.possible;
        } else {
            minor_score_sum += s.score;
            minor_possible_sum += s.possible;
        }
    }

    let major_pct = if major_possible_sum > 0.0 {
        major_score_sum / major_possible_sum * 60.0
    } else {
        0.0
    };
    let minor_pct = if minor_possible_sum > 0.0 {
        minor_score_sum / minor_possible_sum * 40.0
    } else {
        0.0
    };
    let total = major_pct + minor_pct;

    let major_avg = if major_possible_sum > 0.0 {
        (major_score_sum / major_possible_sum * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    };
    let minor_avg = if minor_possible_sum > 0.0 {
        (minor_score_sum / minor_possible_sum * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    };

    (total, major_avg, minor_avg, (major_pct + minor_pct) * 10.0_f64.round() / 10.0)
}

#[tauri::command]
fn add_score(
    state: State<AppState>,
    subject: String,
    earned: f64,
    possible: f64,
    score_type: String,
    date: String,
    note: String,
) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO scores (subject, score, possible, score_type, date, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![subject, earned, possible, score_type, date, note],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn update_score(
    state: State<AppState>,
    id: i64,
    earned: f64,
    possible: f64,
    score_type: String,
    date: String,
    note: String,
) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE scores SET score = ?1, possible = ?2, score_type = ?3, date = ?4, note = ?5 WHERE id = ?6",
        params![earned, possible, score_type, date, note, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn delete_score(state: State<AppState>, id: i64) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM scores WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn get_scores(state: State<AppState>, subject: Option<String>) -> Result<Vec<Score>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let sql = "SELECT id, subject, score, possible, score_type, date, note FROM scores";
    let mut stmt = if subject.is_some() {
        conn.prepare(&format!("{} WHERE subject = ?1 ORDER BY date DESC, id DESC", sql))
            .map_err(|e| e.to_string())?
    } else {
        conn.prepare(&format!("{} ORDER BY date DESC, id DESC", sql))
            .map_err(|e| e.to_string())?
    };
    let rows = if let Some(ref s) = subject {
        stmt.query(params![s]).map_err(|e| e.to_string())?
    } else {
        stmt.query([]).map_err(|e| e.to_string())?
    };
    let mut rows = rows;
    let mut scores = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        scores.push(Score {
            id: Some(row.get(0).map_err(|e| e.to_string())?),
            subject: row.get(1).map_err(|e| e.to_string())?,
            score: row.get(2).map_err(|e| e.to_string())?,
            possible: row.get(3).map_err(|e| e.to_string())?,
            score_type: row.get(4).map_err(|e| e.to_string())?,
            date: row.get(5).map_err(|e| e.to_string())?,
            note: row.get(6).map_err(|e| e.to_string())?,
        });
    }
    Ok(scores)
}

#[tauri::command]
fn get_stats(state: State<AppState>, subject: String) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT score, possible, score_type FROM scores WHERE subject = ?1 ORDER BY date DESC, id DESC LIMIT 50")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![subject]).map_err(|e| e.to_string())?;
    let mut scores = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        scores.push(ScoreRow {
            score: row.get(0).map_err(|e| e.to_string())?,
            possible: row.get(1).map_err(|e| e.to_string())?,
            score_type: row.get(2).map_err(|e| e.to_string())?,
        });
    }
    if scores.is_empty() {
        return Ok(serde_json::json!({
            "subject": subject,
            "total": serde_json::Value::Null,
            "majorAvg": serde_json::Value::Null,
            "minorAvg": serde_json::Value::Null,
            "majorCount": 0,
            "minorCount": 0,
            "count": 0
        }));
    }
    let (total, major_avg, minor_avg, _) = calc_weighted_avg(&scores);
    let major_count = scores.iter().filter(|s| s.score_type == "Major").count();
    let minor_count = scores.iter().filter(|s| s.score_type == "Minor").count();
    Ok(serde_json::json!({
        "subject": subject,
        "total": (total * 10.0).round() / 10.0,
        "majorAvg": major_avg,
        "minorAvg": minor_avg,
        "majorCount": major_count,
        "minorCount": minor_count,
        "count": scores.len()
    }))
}

#[tauri::command]
fn set_goal(state: State<AppState>, subject: String, goal: f64) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM goals WHERE subject = ?1",
            params![subject],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists {
        conn.execute(
            "UPDATE goals SET goal = ?1 WHERE subject = ?2",
            params![goal, subject],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO goals (subject, goal) VALUES (?1, ?2)",
            params![subject, goal],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(true)
}

#[tauri::command]
fn get_goals(state: State<AppState>) -> Result<Vec<Goal>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, subject, goal FROM goals")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut goals = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        goals.push(Goal {
            id: Some(row.get(0).map_err(|e| e.to_string())?),
            subject: row.get(1).map_err(|e| e.to_string())?,
            goal: row.get(2).map_err(|e| e.to_string())?,
        });
    }
    Ok(goals)
}

#[tauri::command]
fn get_report(state: State<AppState>) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let subjects = [
        "Speech & Debate", "English 7", "Chemistry", "East Asian History",
        "Chinese 7", "Computer Science 7", "Algebra & Geometry I",
        "Physics 7", "Biology 7 New",
    ];
    let mut subject_stats = serde_json::Map::new();
    let mut total_gpa = 0.0;
    let mut count = 0;
    let mut all_avgs = Vec::new();

    for subj in &subjects {
        let mut stmt = conn
            .prepare("SELECT score, possible, score_type FROM scores WHERE subject = ?1 ORDER BY date DESC, id DESC LIMIT 50")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![subj]).map_err(|e| e.to_string())?;
        let mut scores = Vec::new();
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            scores.push(ScoreRow {
                score: row.get(0).map_err(|e| e.to_string())?,
                possible: row.get(1).map_err(|e| e.to_string())?,
                score_type: row.get(2).map_err(|e| e.to_string())?,
            });
        }
        if scores.is_empty() {
            subject_stats.insert(subj.to_string(), serde_json::json!({"total": serde_json::Value::Null, "majorAvg": serde_json::Value::Null, "minorAvg": serde_json::Value::Null, "count": 0}));
            continue;
        }
        let (total, major_avg, minor_avg, _) = calc_weighted_avg(&scores);
        let gpa = total / 100.0 * 4.0;
        subject_stats.insert(
            subj.to_string(),
            serde_json::json!({"total": (total * 10.0).round() / 10.0, "majorAvg": major_avg, "minorAvg": minor_avg, "count": scores.len()}),
        );
        total_gpa += gpa;
        count += 1;
        all_avgs.push((subj.clone(), total));
    }

    all_avgs.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    let weakest: Vec<String> = all_avgs.iter().take(2).map(|(s, _)| (*s).to_string()).collect();
    let strongest: Vec<String> = all_avgs.iter().rev().take(2).map(|(s, _)| (*s).to_string()).collect();

    Ok(serde_json::json!({
        "GPA": if count > 0 { (total_gpa / count as f64 * 100.0).round() / 100.0 } else { 0.0 },
        "subjectStats": subject_stats,
        "weakest": weakest,
        "strongest": strongest
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("grade-tracker");
    std::fs::create_dir_all(&app_dir).ok();
    let db_path = app_dir.join("grades.db");
    let conn = Connection::open(&db_path).expect("Failed to open DB");
    conn.execute(
        "CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, score REAL NOT NULL, possible REAL NOT NULL, score_type TEXT NOT NULL, date TEXT NOT NULL, note TEXT DEFAULT '')",
        [],
    )
    .ok();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT UNIQUE NOT NULL, goal REAL NOT NULL)",
        [],
    )
    .ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { db: Mutex::new(conn) })
        .invoke_handler(tauri::generate_handler![
            add_score,
            update_score,
            delete_score,
            get_scores,
            get_stats,
            set_goal,
            get_goals,
            get_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
