// ─── State ──────────────────────────────────────────────────────────────────
var currentContext = null; // 'alpha' | 'beta' | 'all' | 'support'

// ─── History (URL Hash Storage) ─────────────────────────────────────────────
// History is serialised into the page URL hash so any team member who opens
// the same link gets the same rotation state — no server or database needed.

// The hash is kept as short as possible so the share link fits tight limits
// (e.g. a Slack topic, 250 chars). Instead of base64-encoded JSON we serialise a
// compact string: people are stored as their roster INDEX (one base36 char),
// squads are derived from the roster (not stored), and dates are delta-encoded.
// Format:  #d=<alpha>~<beta>~<all>~<queuePrimary>~<queueSecondary>~<skip>~<rounds>
// where each of the first six is a run of index chars, and <rounds> is
// dot-separated tokens "<deltaDaysBase36><primaryChar><secondaryChar>" ('_' = none).
var _HIST_EPOCH = Date.UTC(2020, 0, 1);

function _defaultHistory() {
    return { alpha: [], beta: [], all: [], supportQueuePrimary: [], supportQueueSecondary: [], supportSkip: [], supportRounds: [] };
}

function _rosterNames() {
    var a = [];
    getAllButtons().forEach(function (b) { a.push($(b).text()); });
    return a;
}

function _daysToIso(days) {
    var dt = new Date(_HIST_EPOCH + days * 86400000);
    return dt.getUTCFullYear() + '-'
        + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(dt.getUTCDate()).padStart(2, '0');
}
function _isoToDays(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return 0;
    return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - _HIST_EPOCH) / 86400000);
}

function _encodeHistory(history) {
    var names = _rosterNames();
    var idx = {};
    names.forEach(function (n, i) { idx[n] = i; });
    var ix = function (arr) {
        return (arr || []).map(function (n) { return idx[n] != null ? idx[n].toString(36) : ''; }).join('');
    };
    var ch = function (name) { return (name != null && idx[name] != null) ? idx[name].toString(36) : '_'; };
    var prev = null;
    var rounds = (history.supportRounds || []).map(function (rd) {
        var day = _isoToDays(rd.date);
        var delta = prev == null ? day : (day - prev);
        prev = day;
        return delta.toString(36) + ch(rd.primary && rd.primary.name) + ch(rd.secondary && rd.secondary.name);
    }).join('.');
    return [ix(history.alpha), ix(history.beta), ix(history.all),
            ix(history.supportQueuePrimary), ix(history.supportQueueSecondary),
            ix(history.supportSkip), rounds].join('~');
}

function _decodeHistoryCompact(str) {
    var names = _rosterNames();
    var parts = String(str).split('~');
    var toNames = function (s) {
        var out = [];
        for (var i = 0; i < (s || '').length; i++) {
            var k = parseInt(s[i], 36);
            if (!isNaN(k) && names[k] != null) out.push(names[k]);
        }
        return out;
    };
    var person = function (chr) {
        if (chr === '_' ) return null;
        var k = parseInt(chr, 36);
        var name = (!isNaN(k) && names[k] != null) ? names[k] : null;
        return name ? { name: name, squad: _supportSquadOf(name) } : null;
    };
    var rounds = [];
    var roundsStr = parts[6] || '';
    if (roundsStr) {
        var cum = null;
        roundsStr.split('.').forEach(function (tok) {
            if (!tok) return;
            var s = tok.charAt(tok.length - 1);
            var p = tok.charAt(tok.length - 2);
            var delta = parseInt(tok.slice(0, tok.length - 2) || '0', 36);
            if (isNaN(delta)) delta = 0;
            cum = cum == null ? delta : cum + delta;
            rounds.push({ date: _daysToIso(cum), primary: person(p), secondary: person(s) });
        });
    }
    var h = _defaultHistory();
    h.alpha = toNames(parts[0]); h.beta = toNames(parts[1]); h.all = toNames(parts[2]);
    h.supportQueuePrimary = toNames(parts[3]); h.supportQueueSecondary = toNames(parts[4]);
    h.supportSkip = toNames(parts[5]); h.supportRounds = rounds;
    return h;
}

// Legacy reader: old links stored base64-encoded JSON under #data=.
function _decodeHistoryLegacy(encoded) {
    var binary = atob(encoded);
    var bytes = Uint8Array.from(binary, function (c) { return c.charCodeAt(0); });
    return Object.assign(_defaultHistory(), JSON.parse(new TextDecoder().decode(bytes)));
}

function loadHistory() {
    try {
        var hash = window.location.hash;
        if (hash && hash.indexOf('#d=') === 0) return _decodeHistoryCompact(hash.slice(3));
        if (hash && hash.indexOf('#data=') === 0) return _decodeHistoryLegacy(hash.slice(6));
    } catch (e) { /* corrupt hash — start fresh */ }
    return _defaultHistory();
}

function saveHistory(history) {
    var scrollY = window.scrollY;
    window.location.hash = 'd=' + _encodeHistory(history);
    window.scrollTo(0, scrollY);
}

function addToHistory(context, name) {
    if (!context) return;
    var history = loadHistory();
    if (!history[context]) history[context] = [];
    if (history[context].indexOf(name) === -1) {
        history[context].push(name);
        saveHistory(history);
    }
}

function resetContextHistory(context) {
    if (!context) return;
    var history = loadHistory();
    history[context] = [];
    saveHistory(history);
}

function updateHistoryDisplay() {
    var label = document.getElementById('historyContextLabel');
    var historyList = document.getElementById('historyList');
    var selectedDisplay = document.getElementById('selectedDisplay');
    var clearBtn = document.getElementById('clearHistoryBtn');

    var contextLabels = { alpha: 'Alpha', beta: 'Beta', all: 'All', support: 'Support Champion' };
    label.textContent = currentContext ? (contextLabels[currentContext] || currentContext) : '\u2014';

    var historyLabel = document.getElementById('historyLabel');
    if (historyLabel) historyLabel.textContent = (currentContext === 'support') ? 'History:' : 'Already picked:';

    var buttons = getAllButtons();
    var selected = [];
    buttons.forEach(function (item) {
        if ($(item).hasClass('btn-primary')) selected.push(escapeHtml($(item).text()));
    });
    selectedDisplay.innerHTML = selected.length > 0
        ? selected.map(function (n) { return '<span class="badge bg-primary me-1">' + n + '</span>'; }).join('')
        : '<span class="text-muted">none</span>';

    if (!currentContext) {
        historyList.style.display = '';
        historyList.innerHTML = '<span class="text-muted">&mdash;</span>';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }

    if (clearBtn) clearBtn.style.display = '';

    var history = loadHistory();
    if (currentContext === 'support') {
        historyList.style.display = 'block';
        var rounds = history.supportRounds || [];
        var squadLabel = function (sq) { return sq === 'alpha' ? 'Alpha' : (sq === 'beta' ? 'Beta' : ''); };
        var fmtDate = function (iso) {
            var parts = String(iso || '').split('-');
            if (parts.length !== 3) return '';
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
            if (!m || !d) return '';
            return d + ' ' + months[m - 1];
        };
        var cell = function (x) {
            if (!x) return '<span class="text-muted">&mdash;</span>';
            var sq = squadLabel(x.squad);
            return escapeHtml(x.name) + (sq ? ' <span class="text-muted">(' + sq + ')</span>' : '');
        };
        if (rounds.length === 0) {
            historyList.innerHTML = '<span class="text-muted">none yet</span>';
        } else {
            var rowsHtml = '';
            for (var ri = rounds.length - 1; ri >= 0; ri--) {
                var rd = rounds[ri];
                var when = fmtDate(rd.date) || String(ri + 1);
                rowsHtml += '<tr>'
                    + '<td class="text-muted" style="white-space:nowrap;">' + escapeHtml(when) + '</td>'
                    + '<td>' + cell(rd.primary) + '</td>'
                    + '<td>' + cell(rd.secondary) + '</td>'
                    + '</tr>';
            }
            historyList.innerHTML =
                '<table class="table table-sm table-borderless mb-0 mt-1 align-middle" style="font-size:0.8rem;">'
                + '<thead><tr>'
                + '<th class="fw-normal text-muted" style="white-space:nowrap;">Date</th>'
                + '<th class="fw-semibold">Primary</th>'
                + '<th class="fw-semibold">Secondary</th>'
                + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>';
        }
    } else {
        historyList.style.display = '';
        var contextHistory = history[currentContext] || [];
        historyList.innerHTML = contextHistory.length > 0
            ? contextHistory.map(function (n) { return '<span class="badge bg-secondary me-1">' + escapeHtml(n) + '</span>'; }).join('')
            : '<span class="text-muted">none yet</span>';
    }
}

function clearCurrentHistory() {
    if (!currentContext) return;
    if (currentContext === 'support') {
        var h = loadHistory();
        h.supportQueuePrimary = [];
        h.supportQueueSecondary = [];
        h.supportSkip = [];
        h.supportRounds = [];
        saveHistory(h);
    } else {
        resetContextHistory(currentContext);
    }
    updateHistoryDisplay();
}

function copyShareLink() {
    var url = window.location.href;
    var msg = { title: 'Link copied!', html: 'Share this URL with your team to keep everyone in sync.', icon: 'info', timer: 2500, showConfirmButton: false };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { Swal.fire(msg); });
    } else {
        var input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        Swal.fire(msg);
    }
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Load Page ───────────────────────────────────────────────────────────────
function init() {
    let facilitatorsList = [
        { Name: "Alex", Role: "tl", Team: "all" },
        { Name: "Stephan", Role: "tl", Team: "all" },
        { Name: "Jo&atilde;o", Role: "dev", Team: "beta" },
        { Name: "JD", Role: "dev", Team: "beta" },
        { Name: "Adam", Role: "pm", Team: "beta" },
        { Name: "Zhipeng", Role: "dev", Team: "alpha" },
        { Name: "Douglas", Role: "dev", Team: "alpha" },
        { Name: "Bruno", Role: "dev", Team: "alpha" },
        { Name: "Pavel", Role: "pm", Team: "alpha" },
        { Name: "Luis", Role: "dev", Team: "alpha" },
        { Name: "Louren&ccedil;o", Role: "dev", Team: "beta" },
        { Name: "Vencel", Role: "pm", Team: "alpha" },
    ];

    facilitatorsList.sort(SortByName);

    let facilitatorsDiv = document.getElementById("facilitatorsList");
    facilitatorsList.forEach((item, index) => {

        //input checkbox
        let button = document.createElement('button');
        $(button).css("width", 100);
        $(button).css("margin-bottom", 20);
        $(button).css("cursor", "pointer");
        $(button).addClass("btn btn-primary");
        $(button).html(item.Name);
        $(button).prop("role", item.Role);
        $(button).prop("team", item.Team);
        $(button).click(btnFacilitatorButtonClick);

        //div
        let div = document.createElement('div');
        $(div).addClass("col col-md-3");
        div.appendChild(button);

        // final div
        facilitatorsDiv.appendChild(div);

    });

    updateHistoryDisplay();
}

// Squad ('alpha'|'beta'|null) of a member by display name (display label only).
function _supportSquadOf(name) {
    var squad = null;
    getAllButtons().forEach(function (item) {
        if ($(item).text() === name) {
            var t = ($(item).prop('team') || '').toLowerCase();
            if (t === 'alpha' || t === 'beta') squad = t;
        }
    });
    return squad;
}

// All eligible Support Champ members (devs + pms, any squad). TLs excluded.
function _supportEligible() {
    var names = [];
    getAllButtons().forEach(function (item) {
        var r = ($(item).prop('role') || '').toLowerCase();
        var t = ($(item).prop('team') || '').toLowerCase();
        if ((r === 'dev' || r === 'pm') && (t === 'alpha' || t === 'beta')) names.push($(item).text());
    });
    return names;
}

// Eligible members whose button is currently enabled (selected).
function _supportEnabledSet() {
    var set = {};
    getAllButtons().forEach(function (item) {
        var r = ($(item).prop('role') || '').toLowerCase();
        var t = ($(item).prop('team') || '').toLowerCase();
        if ((r === 'dev' || r === 'pm') && (t === 'alpha' || t === 'beta') && $(item).hasClass('btn-primary')) {
            set[$(item).text()] = true;
        }
    });
    return set;
}

// (Re)build the manual Primary/Secondary dropdowns from the eligible dev/pm pool.
// Lists ALL eligible members regardless of queue position (manual can override).
function populateManualChampSelects() {
    var selP = document.getElementById('selManualPrimary');
    var selS = document.getElementById('selManualSecondary');
    if (!selP || !selS) return;
    var prevP = selP.value, prevS = selS.value;

    var members = [];
    getAllButtons().forEach(function (item) {
        var r = ($(item).prop('role') || '').toLowerCase();
        var t = ($(item).prop('team') || '').toLowerCase();
        if ((r === 'dev' || r === 'pm') && (t === 'alpha' || t === 'beta')) {
            members.push({ name: $(item).text(), squad: t });
        }
    });

    var optsHtml = '<option value="">Auto</option>' + members.map(function (m) {
        var label = escapeHtml(m.name) + ' (' + (m.squad === 'alpha' ? 'Alpha' : 'Beta') + ')';
        return '<option value="' + escapeHtml(m.name) + '">' + label + '</option>';
    }).join('');

    selP.innerHTML = optsHtml;
    selS.innerHTML = optsHtml;
    selP.value = prevP; if (selP.value !== prevP) selP.value = '';
    selS.value = prevS; if (selS.value !== prevS) selS.value = '';
}

// Keep the two rotation queues in sync with the current roster: drop members who
// are no longer eligible, de-duplicate, and enqueue any new members onto the shorter
// queue (so the Primary/Secondary sides stay balanced). Persists + returns them.
function _ensureSupportQueues() {
    var eligible = _supportEligible();
    var elig = {};
    eligible.forEach(function (n) { elig[n] = true; });

    var h = loadHistory();
    var qp = (h.supportQueuePrimary || []).filter(function (n) { return elig[n]; });
    var qs = (h.supportQueueSecondary || []).filter(function (n) { return elig[n]; });

    // De-duplicate within and across the two queues.
    var seen = {};
    qp = qp.filter(function (n) { if (seen[n]) return false; seen[n] = true; return true; });
    qs = qs.filter(function (n) { if (seen[n]) return false; seen[n] = true; return true; });

    // New members join the shorter queue (ties -> Primary side).
    eligible.forEach(function (n) {
        if (seen[n]) return;
        if (qp.length <= qs.length) qp.push(n); else qs.push(n);
        seen[n] = true;
    });

    h.supportQueuePrimary = qp;
    h.supportQueueSecondary = qs;
    saveHistory(h);
    return { qp: qp, qs: qs };
}

// Remove and return the first enabled, non-excluded name from `queue`; else null.
function _takeFromQueue(queue, enabledSet, exclude) {
    for (var i = 0; i < queue.length; i++) {
        var n = queue[i];
        if (enabledSet[n] && exclude.indexOf(n) === -1) {
            queue.splice(i, 1);
            return n;
        }
    }
    return null;
}

function getSupportChampions() {
    var eligible = _supportEligible();
    if (eligible.length === 0) {
        unloadSpinner();
        Swal.fire("It's cold here... :(", "Is anyone there?", 'question');
        return;
    }

    // Optional manual overrides ('' = Auto).
    var manualPrimary   = (document.getElementById('selManualPrimary')   || {}).value || '';
    var manualSecondary = (document.getElementById('selManualSecondary') || {}).value || '';
    if (manualPrimary && manualSecondary && manualPrimary === manualSecondary) {
        unloadSpinner();
        Swal.fire('Hold on!', 'The same person cannot be both Primary and Secondary.', 'warning');
        return;
    }

    // Sync queues with the roster, then work on local copies.
    var queues = _ensureSupportQueues();
    var qp = queues.qp.slice();
    var qs = queues.qs.slice();

    var enabled = _supportEnabledSet();
    // Manual picks are always allowed even if their button is deselected.
    if (manualPrimary) enabled[manualPrimary] = true;
    if (manualSecondary) enabled[manualSecondary] = true;

    var removeFrom = function (arr, x) { var i = arr.indexOf(x); if (i !== -1) arr.splice(i, 1); };

    var primaryName = null, secondaryName = null;

    if (manualPrimary) { primaryName = manualPrimary; removeFrom(qp, primaryName); removeFrom(qs, primaryName); }
    if (manualSecondary) { secondaryName = manualSecondary; removeFrom(qp, secondaryName); removeFrom(qs, secondaryName); }

    // Fill remaining slot(s) from the queues (Primary from due-Primary, Secondary
    // from due-Secondary), falling back to the other queue only if one runs dry.
    if (!primaryName) {
        primaryName = _takeFromQueue(qp, enabled, secondaryName ? [secondaryName] : []);
        if (!primaryName) primaryName = _takeFromQueue(qs, enabled, secondaryName ? [secondaryName] : []);
    }
    if (!secondaryName) {
        secondaryName = _takeFromQueue(qs, enabled, primaryName ? [primaryName] : []);
        if (!secondaryName) secondaryName = _takeFromQueue(qp, enabled, primaryName ? [primaryName] : []);
    }

    if (!primaryName && !secondaryName) {
        unloadSpinner();
        Swal.fire("It's cold here... :(", "Is anyone there?", 'question');
        return;
    }

    // Build champs; a lone champ (only one available) is shown as Primary.
    var champs = [];
    if (primaryName)   champs.push({ name: primaryName,   squad: _supportSquadOf(primaryName),   role: 'primary'   });
    if (secondaryName) champs.push({ name: secondaryName, squad: _supportSquadOf(secondaryName), role: 'secondary' });
    if (champs.length === 1) champs[0].role = 'primary';

    // Re-queue each served champ to the BACK of the opposite queue (strict alternation).
    champs.forEach(function (ch) {
        removeFrom(qp, ch.name); removeFrom(qs, ch.name);
        if (ch.role === 'primary') qs.push(ch.name); else qp.push(ch.name);
    });

    // Record the round with today's date.
    var today = new Date();
    var dateStr = today.getFullYear() + '-'
        + String(today.getMonth() + 1).padStart(2, '0') + '-'
        + String(today.getDate()).padStart(2, '0');
    var roundPrimary = null, roundSecondary = null;
    champs.forEach(function (ch) {
        if (ch.role === 'primary') roundPrimary = { name: ch.name, squad: ch.squad };
        else roundSecondary = { name: ch.name, squad: ch.squad };
    });

    var latest = loadHistory();
    latest.supportQueuePrimary = qp;
    latest.supportQueueSecondary = qs;
    latest.supportRounds = latest.supportRounds || [];
    latest.supportRounds.push({ date: dateStr, primary: roundPrimary, secondary: roundSecondary });
    var MAX_ROUNDS = 30; // keep the share link short enough for a Slack topic (<=250 chars)
    if (latest.supportRounds.length > MAX_ROUNDS) latest.supportRounds = latest.supportRounds.slice(-MAX_ROUNDS);
    saveHistory(latest);

    // Reset the manual dropdowns back to Auto for the next rotation.
    var selP = document.getElementById('selManualPrimary');
    var selS = document.getElementById('selManualSecondary');
    if (selP) selP.value = '';
    if (selS) selS.value = '';

    refreshContext();

    // Popup: Primary first, then Secondary.
    var champsSorted = champs.slice().sort(function (a, b) {
        if (a.role === b.role) return 0;
        return a.role === 'primary' ? -1 : 1;
    });
    var resultParts = champsSorted.map(function (ch) {
        var label = ch.role === 'primary' ? 'Primary' : 'Secondary';
        var squadLabel = ch.squad === 'alpha' ? 'Alpha' : (ch.squad === 'beta' ? 'Beta' : '');
        return '<b>' + label + ':</b> ' + escapeHtml(ch.name) + (squadLabel ? ' <span class="text-muted">(' + squadLabel + ')</span>' : '');
    });

    Swal.fire({ title: 'Support Champions!', html: resultParts.join('<br>'), icon: 'success', confirmButtonText: 'Cool!' });
    unloadSpinner();
}

// Main Functionality: define facilitator based on the configuration
// Called in the btnDefineFacilitator click event
function getFacilitator() {
    if (currentContext === 'support') {
        getSupportChampions();
        return;
    }

    let buttons = getAllButtons();
    let facilitatorsArray = [];

    buttons.forEach((item) => {
        if ($(item).hasClass("btn-primary"))
            facilitatorsArray.push($(item).text());
    });

    if (facilitatorsArray.length === 0) {
        unloadSpinner();
        Swal.fire("It's cold here... :(", "Is anyone there?", 'question');
        return;
    }

    // Exclude members already picked in this context's rotation cycle
    var history = loadHistory();
    var contextHistory = currentContext ? (history[currentContext] || []) : [];
    var eligible = facilitatorsArray.filter(function (name) {
        return contextHistory.indexOf(name) === -1;
    });

    var cycleReset = false;
    if (eligible.length === 0) {
        // Everyone in the pool has been picked — reset and start a new cycle
        cycleReset = true;
        resetContextHistory(currentContext);
        eligible = facilitatorsArray.slice();
    }

    var randomIndex = Math.floor(Math.random() * eligible.length);
    var facilitator = eligible[randomIndex];

    addToHistory(currentContext, facilitator);
    disableButtonByName(facilitator);
    refreshContext();

    var title = 'Congratulations, ' + facilitator + '!';
    var message = 'You are the chosen one!';

    if (cycleReset && currentContext) {
        message += '<br><br><small class="text-muted">Everyone in the pool had been picked — history was reset for a new cycle.</small>';
    }

    Swal.fire({ title: title, html: message, icon: 'success', confirmButtonText: 'Cool!' });
    unloadSpinner();
}

// Events / Clicks

function refreshContext() {
    if (currentContext === 'alpha')        btnAlpha_Click();
    else if (currentContext === 'beta')   btnBeta_Click();
    else if (currentContext === 'all')    btnAll_Click();
    else if (currentContext === 'support') btnSupportChampion_Click();
    else updateHistoryDisplay();
}

function setActiveContext(context, buttonId) {
    currentContext = context;
    ['btnAlpha', 'btnBeta', 'btnAll', 'btnSupportChampion'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active-context');
    });
    if (buttonId) {
        var active = document.getElementById(buttonId);
        if (active) active.classList.add('active-context');
    }
    var manualPanel = document.getElementById('manualChampPanel');
    if (manualPanel) manualPanel.style.display = (context === 'support') ? '' : 'none';
}

function btnAll_Click() {
    setActiveContext('all', 'btnAll');
    var alreadyPicked = loadHistory().all || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        if (alreadyPicked.indexOf($(item).text()) === -1) {
            enabledButton(item);
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnSupportChampion_Click() {
    setActiveContext('support', 'btnSupportChampion');
    populateManualChampSelects();
    _ensureSupportQueues();
    var skip = loadHistory().supportSkip || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var r = ($(item).prop("role") || '').toLowerCase();
        var t = ($(item).prop("team") || '').toLowerCase();
        if ((r === "dev" || r === "pm") && (t === 'alpha' || t === 'beta')) {
            if (skip.indexOf($(item).text()) === -1) enabledButton(item);
            else disabledButton(item);
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnOnlyDevs_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var role = $(item).prop("role");
        if (role.toLowerCase() == "dev") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnOnlyNonDevs_Click() {
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        let role = $(item).prop("role");
        if (role.toLowerCase() != "dev") {
            enabledButton(item);
        }
        else {
            disabledButton(item);
        }

    });
}

function btnAlpha_Click() {
    setActiveContext('alpha', 'btnAlpha');
    var alreadyPicked = loadHistory().alpha || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        let team = $(item).prop("team");
        if (team.toLowerCase() == "alpha") {
            if (alreadyPicked.indexOf($(item).text()) === -1) {
                enabledButton(item);
            } else {
                disabledButton(item);
            }
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnBeta_Click() {
    setActiveContext('beta', 'btnBeta');
    var alreadyPicked = loadHistory().beta || [];
    let buttons = getAllButtons();
    buttons.forEach((item) => {
        var team = $(item).prop("team");
        if (team.toLowerCase() == "beta") {
            if (alreadyPicked.indexOf($(item).text()) === -1) {
                enabledButton(item);
            } else {
                disabledButton(item);
            }
        } else {
            disabledButton(item);
        }
    });
    updateHistoryDisplay();
}

function btnFacilitatorButtonClick() {
    let isEnabled = $(this).hasClass("btn-primary");

    if (isEnabled) {
        disabledButton(this);
    }
    else {
        enabledButton(this);
    }
    if (currentContext === 'support') _syncSupportSkipFromButtons();
    updateHistoryDisplay();
}

// Persist the set of eligible members the user has deselected (skipped) in Support
// context so the exclusion survives view refreshes and future picks.
function _syncSupportSkipFromButtons() {
    var skip = [];
    getAllButtons().forEach(function (item) {
        var r = ($(item).prop('role') || '').toLowerCase();
        var t = ($(item).prop('team') || '').toLowerCase();
        if ((r === 'dev' || r === 'pm') && (t === 'alpha' || t === 'beta') && !$(item).hasClass('btn-primary')) {
            skip.push($(item).text());
        }
    });
    var h = loadHistory();
    h.supportSkip = skip;
    saveHistory(h);
}

function btnDefineFacilitator_Click() {

    loadSpinner();

    window.setTimeout(getFacilitator, 500);


}

// Sort Array
function SortByName(a, b) {
    let aName = a.Name.toLowerCase();
    let bName = b.Name.toLowerCase();
    return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

// Get All Buttons
function getAllButtons() {
    let buttons = document
        .getElementById("facilitatorsList")
        .querySelectorAll('button');
    return buttons;
}

// Spinner Functions
function loadSpinner() {
    document.getElementById("btnDefineFacilitator").setAttribute("disabled", true);
    document.getElementById("spinner").style.display = "inline-flex";
}

function unloadSpinner() {
    document.getElementById("btnDefineFacilitator").removeAttribute("disabled");
    document.getElementById("spinner").style.display = "none";
}

function enabledButton(button) {
    $(button).removeClass("btn-default");
    $(button).addClass("btn-primary");
    $(button).css("cursor", "pointer");
}

function disabledButton(button) {
    $(button).removeClass("btn-primary");
    $(button).addClass("btn-default");
    $(button).css("cursor", "not-allowed");
}

function disableButtonByName(name) {
    getAllButtons().forEach(function (item) {
        if ($(item).text() === name) disabledButton(item);
    });
}



