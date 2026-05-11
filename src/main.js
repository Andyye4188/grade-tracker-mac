const { invoke } = window.__TAURI__.core;
const { ask } = window.__TAURI__.dialog;

const SUBJECTS = [
  "Speech & Debate", "English 7", "Chemistry", "East Asian History",
  "Chinese 7", "Computer Science 7", "Algebra & Geometry I",
  "Physics 7", "Biology 7 New"
];

// Navigation
document.querySelectorAll('.nav-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { showPage(btn.dataset.page); });
});

function showPage(page) {
  document.querySelectorAll('.page').forEach(function(p) { p.style.display = 'none'; });
  document.getElementById('page-' + page).style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelector('.nav-btn[data-page="' + page + '"]').classList.add('active');
  if (page === 'dashboard') loadDashboard();
  else if (page === 'stats') loadStats();
  else if (page === 'goals') loadGoals();
  else if (page === 'report') loadReport();
}

// Toast
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// Goal Modal
var _goalModalSubj = '';
function openGoalModal(subj) {
  _goalModalSubj = subj;
  document.getElementById('goal-modal-subj').textContent = subj;
  document.getElementById('goal-modal-input').value = '';
  document.getElementById('goal-modal').style.display = 'flex';
  document.getElementById('goal-modal-input').focus();
}
function closeGoalModal() {
  document.getElementById('goal-modal').style.display = 'none';
}
function submitGoalModal() {
  var val = parseFloat(document.getElementById('goal-modal-input').value);
  if (isNaN(val)) { closeGoalModal(); return; }
  invoke('set_goal', { subject: _goalModalSubj, goal: val })
    .then(function() {
      var id = 'goal-display-' + _goalModalSubj.replace(/\s/g, '_');
      var el = document.getElementById(id);
      if (el) el.textContent = val;
      closeGoalModal();
      toast('Goal saved!');
    })
    .catch(function(err) { toast('Error: ' + err); });
}

// Dashboard
async function loadDashboard() {
  var grid = document.getElementById('subject-grid');
  grid.innerHTML = '';
  try {
    var rep = await invoke('get_report');
    for (var i = 0; i < SUBJECTS.length; i++) {
      var subj = SUBJECTS[i];
      var stat = rep.subjectStats && rep.subjectStats[subj];
      var total = stat && stat.total !== null ? stat.total : '--';
      var trend = stat && stat.total !== null ? (stat.total >= 70 ? '\u2191' : '\u2193') : '\u2192';
      var trendClass = stat && stat.total !== null ? (stat.total >= 70 ? 'trend-up' : 'trend-down') : 'trend-flat';
      var card = document.createElement('div');
      card.className = 'subject-card';
      card.innerHTML = '<div class="subj-name">' + subj + '</div><div class="subj-avg">' + total + '</div><div class="subj-trend ' + trendClass + '">' + trend + '</div>';
      card.addEventListener('click', function(s) { return function() { window.__currentSubject = s; showPage('stats'); }; }(subj));
      grid.appendChild(card);
    }
    document.getElementById('header-gpa').textContent = 'GPA: ' + (rep.GPA || '--');
  } catch(e) {
    grid.innerHTML = '<p style="padding:20px">Failed to load: ' + e + '</p>';
  }
}

// Stats
window.__currentSubject = '';
async function loadStats() {
  if (!window.__currentSubject) window.__currentSubject = SUBJECTS[0];
  await loadStatsFor(window.__currentSubject);
}

async function loadStatsFor(subj) {
  window.__currentSubject = subj;
  var sel = document.getElementById('stats-subject-select');
  if (sel) sel.value = subj;
  try {
    var rep = await invoke('get_report');
    var stat = rep.subjectStats && rep.subjectStats[subj];
    var total = stat && stat.total !== null ? stat.total : '--';
    var gpa = stat && stat.total !== null ? (stat.total / 100 * 4).toFixed(2) : '--';
    document.getElementById('stats-total').textContent = total;
    document.getElementById('stats-gpa').textContent = gpa;
    document.getElementById('stats-major').textContent = (stat && stat.majorAvg !== null) ? stat.majorAvg + '%' : '--';
    document.getElementById('stats-minor').textContent = (stat && stat.minorAvg !== null) ? stat.minorAvg + '%' : '--';
  } catch(e) { console.error(e); }

  var list = document.getElementById('stats-list');
  try {
    var allScores = await invoke('get_scores', {});
    var listScores = allScores.filter(function(s) { return s.subject === subj; });
    if (listScores.length === 0) {
      list.innerHTML = '<p style="padding:20px;text-align:center;color:#999">No scores yet</p>';
    } else {
      list.innerHTML = listScores.map(function(s) {
        var pct = s.possible > 0 ? Math.round(s.score / s.possible * 100) : 0;
        var typeClass = s.score_type === 'Major' ? 'type-major' : 'type-minor';
        return '<div class="score-row" id="score-row-' + s.id + '">' +
          '<div class="score-info">' +
            '<span class="score-num" id="score-num-' + s.id + '">' + s.score + '/' + s.possible + '</span>' +
            '<span class="score-type ' + typeClass + '" id="score-type-' + s.id + '">' + s.score_type + '</span>' +
            '<span class="score-pct" id="score-pct-' + s.id + '">' + pct + '%</span>' +
            '<span class="score-date" id="score-date-' + s.id + '">' + s.date + '</span>' +
            '<span style="color:#999;font-size:12px" id="score-note-' + s.id + '">' + (s.note || '') + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:6px" id="score-actions-' + s.id + '">' +
            '<button class="btn-edit" onclick="editScore(' + s.id + ')">Edit</button>' +
            '<button class="btn-delete" onclick="deleteScore(' + s.id + ')">Delete</button>' +
          '</div>' +
          '<div style="display:none;gap:6px;align-items:center" id="score-edit-' + s.id + '">' +
            '<input type="number" id="edit-earned-' + s.id + '" value="' + s.score + '" style="width:60px;padding:4px;border:1px solid #E0E0E0;border-radius:4px;font-size:13px" step="any">/' +
            '<input type="number" id="edit-possible-' + s.id + '" value="' + s.possible + '" style="width:60px;padding:4px;border:1px solid #E0E0E0;border-radius:4px;font-size:13px" step="any">' +
            '<select id="edit-type-' + s.id + '" style="padding:4px;border:1px solid #E0E0E0;border-radius:4px;font-size:12px">' +
              '<option value="Major"' + (s.score_type === 'Major' ? ' selected' : '') + '>Major</option>' +
              '<option value="Minor"' + (s.score_type === 'Minor' ? ' selected' : '') + '>Minor</option>' +
            '</select>' +
            '<input type="date" id="edit-date-' + s.id + '" value="' + s.date + '" style="padding:4px;border:1px solid #E0E0E0;border-radius:4px;font-size:12px">' +
            '<input type="text" id="edit-note-' + s.id + '" value="' + (s.note || '') + '" placeholder="note" style="padding:4px;border:1px solid #E0E0E0;border-radius:4px;font-size:12px;width:80px">' +
            '<button class="btn-save" onclick="saveScore(' + s.id + ')">Save</button>' +
            '<button class="btn-cancel" onclick="cancelEdit(' + s.id + ')">Cancel</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  } catch(e) { console.error(e); }
}

window.editScore = function(id) {
  document.getElementById('score-actions-' + id).style.display = 'none';
  document.getElementById('score-edit-' + id).style.display = 'flex';
};

window.cancelEdit = function(id) {
  document.getElementById('score-actions-' + id).style.display = 'flex';
  document.getElementById('score-edit-' + id).style.display = 'none';
};

window.saveScore = async function(id) {
  var earned = parseFloat(document.getElementById('edit-earned-' + id).value);
  var possible = parseFloat(document.getElementById('edit-possible-' + id).value);
  var scoreType = document.getElementById('edit-type-' + id).value;
  var date = document.getElementById('edit-date-' + id).value;
  var note = document.getElementById('edit-note-' + id).value;
  try {
    await invoke('update_score', {id: id, earned: earned, possible: possible, scoreType: scoreType, date: date, note: note});
    await loadStatsFor(window.__currentSubject);
  } catch(e) { toast('Save failed: ' + e); }
};

window.deleteScore = async function(id) {
  var confirmed = await ask('Delete this score?', { title: 'Confirm', kind: 'warning' });
  if (!confirmed) return;
  try {
    await invoke('delete_score', {id: id});
    await loadStatsFor(window.__currentSubject);
  } catch(e) { toast('Delete failed: ' + e); }
};

document.getElementById('stats-back').addEventListener('click', function() { showPage('dashboard'); });
var statsSelect = document.getElementById('stats-subject-select');
if (statsSelect) {
  statsSelect.addEventListener('change', function() {
    if (this.value) { window.__currentSubject = this.value; loadStatsFor(this.value); }
  });
}

// Add Score
document.getElementById('score-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var subj = document.getElementById('add-subject').value;
  var score = parseFloat(document.getElementById('add-score').value);
  var possible = parseFloat(document.getElementById('add-possible').value);
  var scoreType = document.getElementById('add-type').value;
  var date = document.getElementById('add-date').value;
  var note = document.getElementById('add-note').value;
  var msg = document.getElementById('add-msg');
  if (!subj || isNaN(score) || isNaN(possible)) {
    msg.textContent = 'Please fill all required fields';
    msg.className = 'msg err';
    return;
  }
  if (possible <= 0) {
    msg.textContent = 'Possible score must be greater than 0';
    msg.className = 'msg err';
    return;
  }
  try {
    await invoke('add_score', { subject: subj, earned: score, possible: possible, scoreType: scoreType, date: date, note: note });
    msg.textContent = 'Score saved!';
    msg.className = 'msg ok';
    e.target.reset();
    document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    toast('Score submitted!');
  } catch(err) {
    msg.textContent = 'Error: ' + err;
    msg.className = 'msg err';
  }
});

// Goals
async function loadGoals() {
  try {
    var goals = await invoke('get_goals');
    var list = document.getElementById('goals-list');
    list.innerHTML = '';
    for (var i = 0; i < SUBJECTS.length; i++) {
      var subj = SUBJECTS[i];
      var g = null;
      for (var j = 0; j < goals.length; j++) {
        if (goals[j].subject === subj) { g = goals[j]; break; }
      }
      var val = g ? g.goal : '';
      var displayId = 'goal-display-' + subj.replace(/\s/g, '_');
      var row = document.createElement('div');
      row.className = 'goal-row';
      row.innerHTML = '<span class="goal-subj">' + subj + '</span><div><span class="goal-val" id="' + displayId + '">' + (val || '--') + '</span> <button class="goal-edit">Edit</button></div>';
      row.querySelector('.goal-edit').addEventListener('click', function(s) { return function() { openGoalModal(s); }; }(subj));
      list.appendChild(row);
    }
  } catch(e) { console.error(e); }
}

// Report
async function loadReport() {
  try {
    var rep = await invoke('get_report');
    document.getElementById('report-gpa').textContent = 'GPA: ' + (rep.GPA || '--');
    document.getElementById('report-strongest').innerHTML = '';
    if (rep.strongest) {
      for (var i = 0; i < rep.strongest.length; i++) {
        var span = document.createElement('span');
        span.className = 'subj-badge good';
        span.textContent = rep.strongest[i];
        document.getElementById('report-strongest').appendChild(span);
      }
    }
    document.getElementById('report-weakest').innerHTML = '';
    if (rep.weakest) {
      for (var i = 0; i < rep.weakest.length; i++) {
        var span = document.createElement('span');
        span.className = 'subj-badge bad';
        span.textContent = rep.weakest[i];
        document.getElementById('report-weakest').appendChild(span);
      }
    }
    var tbody = document.getElementById('report-tbody');
    tbody.innerHTML = '';
    for (var i = 0; i < SUBJECTS.length; i++) {
      var subj = SUBJECTS[i];
      var st = rep.subjectStats ? rep.subjectStats[subj] : null;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + subj + '</td><td>' + (st && st.total !== null ? st.total : '--') + '</td><td>' + (st ? st.count : 0) + '</td><td>' + (st && st.majorAvg !== null && st.majorAvg > 0 ? 'M:' + st.majorAvg + '%' : '--') + '</td><td>' + (st && st.minorAvg !== null && st.minorAvg > 0 ? 'm:' + st.minorAvg + '%' : '--') + '</td>';
      tbody.appendChild(tr);
    }
  } catch(e) { console.error(e); }
}

// Init
document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
showPage('dashboard');
