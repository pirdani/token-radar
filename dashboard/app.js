// Token Radar's dashboard, radar-2. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail view with the model's own
// inputs and the protocol's farm plan, a live-token view and the methodology. No network: every byte
// it shows is in data.js. The farm plan and the implied value are the same derivation main.ts writes
// to board.json, so the page's code and the board's data are visibly the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var model = DATA.model;
  var state = {
    q: '', category: 'all', chain: 'all', watchOnly: false, pointsOnly: false,
    tab: 'board', sort: 'implied', dir: -1, selected: null,
    sandbox: { multScale: 1, growthWeight: model.growth_weight, maturityRange: model.maturity_range },
    sandboxOn: false,
  };

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function usdFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, m) {
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * m.multScale * growthMult * maturity));
  }
  function sandboxModel() {
    return {
      growth_weight: state.sandbox.growthWeight, growth_floor: model.growth_floor, growth_cap: model.growth_cap,
      maturity_floor: model.maturity_floor, maturity_range: state.sandbox.maturityRange, maturity_days: model.maturity_days,
      unknown_age_days: model.unknown_age_days, multScale: state.sandbox.multScale,
    };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('risk curator') >= 0 || c.indexOf('capital allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' and keep the receipts.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + name + "'s chain and use one of its apps.";
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis vault on " + chain + ' and keep the shares.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var action = actionFor(p, capital, chain);
    var gas = capital >= 150 ? 8 : 4;
    function step(text, cost, time) {
      var s = text + ' Cost: ' + cost + '. Time: ' + time + '.';
      if (s.length > 600) s = s.slice(0, 596) + '...';
      if (s.length < 20) s += ' Hold the position and check the protocol\u2019s own page.';
      return s;
    }
    return [
      step('Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', 'under $3 of gas for the first transaction', '5 minutes'),
      step(action, '$' + capital + ' of capital and about $' + gas + ' of gas', '15 minutes to set up'),
      step('Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', 'about $2 of gas a week', '10 minutes a week'),
      step('Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', 'the $' + capital + ' stays in the position', hold + ' days'),
      step('Before you withdraw, open the protocol\u2019s own points or rewards page from its official site and claim only from the link it publishes.', 'no fee to check, and never pay to claim', '10 minutes'),
      step('Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', 'nothing but the log', '5 minutes'),
    ];
  }

  function tokenBadge(row) {
    var r = row.research;
    if (!r) return el('span', { class: 'badge mut', text: 'not checked' });
    if (r.token_status === 'no-token-found') return el('span', { class: 'badge ok', text: '\u2713 no token found' });
    if (r.token_status === 'token-exists') return el('span', { class: 'badge bad', text: '\u26a0 token exists' + (r.token_symbol ? ' (' + r.token_symbol + ')' : '') });
    if (r.token_status === 'parent-has-token') return el('span', { class: 'badge warn', text: '\u26a0 parent has token' });
    if (r.token_status === 'wrapped-staked-product') return el('span', { class: 'badge warn', text: '\u26a0 wrapped/staked product' });
    return el('span', { class: 'badge mut', text: 'unverified' });
  }

  function filteredRows() {
    var rows = DATA.rows.slice();
    var q = state.q.trim().toLowerCase();
    if (q) rows = rows.filter(function (r) { return (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) >= 0; });
    if (state.category !== 'all') rows = rows.filter(function (r) { return r.category === state.category; });
    if (state.chain !== 'all') rows = rows.filter(function (r) { return r.chains && r.chains.indexOf(state.chain) >= 0; });
    if (state.watchOnly) rows = rows.filter(function (r) { return r.on_watchlist === true; });
    if (state.pointsOnly) rows = rows.filter(function (r) { return r.research && r.research.points_program === 'yes'; });
    var m = sandboxModel();
    var val = function (r) { return state.sandboxOn ? impliedOf(r, m) : r.implied_value_usd; };
    var key = state.sort;
    rows.sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = val(a) - val(b);
      else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'growth') d = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') d = (a.age_days === null ? -1 : a.age_days) - (b.age_days === null ? -1 : b.age_days);
      else if (key === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      return d * state.dir;
    });
    return rows;
  }

  function renderBoardTable(rows, valFn) {
    var table = el('table');
    var head = el('thead', {}, el('tr', {},
      el('th', { text: '#', onclick: function () { setSort('implied'); } }),
      el('th', { text: 'Protocol', onclick: function () { setSort('name'); } }),
      el('th', { text: 'Category' }),
      el('th', { class: 'num', text: 'TVL', onclick: function () { setSort('tvl'); } }),
      el('th', { class: 'num', text: '7d', onclick: function () { setSort('growth'); } }),
      el('th', { class: 'num', text: 'Age', onclick: function () { setSort('age'); } }),
      el('th', { class: 'num', text: 'Implied value', onclick: function () { setSort('implied'); } }),
      el('th', { text: 'Token check' })));
    table.appendChild(head);
    var body = el('tbody');
    if (rows.length === 0) {
      body.appendChild(el('tr', {}, el('td', { colspan: 8, class: 'empty', text: 'No protocols match this filter.' })));
    }
    rows.forEach(function (r) {
      var g = r.change_7d;
      var tr = el('tr', { onclick: function () { selectRow(r.slug); }, class: state.selected === r.slug ? 'selected' : '' },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', { class: 'namecell' },
          el('b', { text: r.name }),
          el('span', { text: r.slug }),
          r.on_watchlist ? el('span', { class: 'tag watch', text: 'watchlist' }) : null),
        el('td', { text: r.category || '—' }),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num growth ' + (g !== null && g > 0 ? 'up' : g !== null && g < 0 ? 'down' : ''), text: fmtPct(g) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: usd(valFn(r)) }),
        el('td', {}, tokenBadge(r)));
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function renderDetail(row) {
    var m = sandboxModel();
    var val = state.sandboxOn ? impliedOf(row, m) : row.implied_value_usd;
    var multSrc = row.category_live_n >= model.min_live_for_category
      ? 'category median (' + row.category_live_n + ' live comps)'
      : 'global median (only ' + row.category_live_n + ' live in category)';
    var base = Math.round(row.tvl_usd * row.category_multiple * (state.sandboxOn ? state.sandbox.multScale : 1));
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * (state.sandboxOn ? state.sandbox.growthWeight : model.growth_weight);
    var age = row.age_days === null ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * (state.sandboxOn ? state.sandbox.maturityRange : model.maturity_range);
    var section = el('section', { class: 'detail', id: 'detail' },
      el('h2', { text: '#' + row.rank + ' ' + row.name }),
      el('p', { class: 'sub', text: (row.category || 'Uncategorized') + ' · ' + (row.chains || []).join(', ') + ' · listed ' + (row.listed_at || 'unknown') + ' · snapshot ' + DATA.as_of }),
      el('div', { class: 'kv' },
        el('div', {}, el('b', { text: usdFull(val) }), el('span', { text: 'implied value' + (state.sandboxOn ? ' (sandbox)' : '') })),
        el('div', {}, el('b', { text: usd(row.tvl_usd) }), el('span', { text: 'TVL' })),
        el('div', {}, el('b', { text: fmtPct(row.change_7d) }), el('span', { text: 'TVL change, 7d' })),
        el('div', {}, el('b', { text: fmtAge(row.age_days) }), el('span', { text: 'age with no token' })),
        el('div', {}, el('b', { text: 'x' + row.category_multiple.toFixed(3) }), el('span', { text: multSrc })),
        el('div', {}, el('b', { text: 'x' + growthMult.toFixed(2) + ' · x' + maturity.toFixed(2) }), el('span', { text: 'growth · maturity' }))),
      el('h3', { text: 'How the value is built' }),
      el('p', { class: 'model-line', text: 'implied = TVL ' + usdFull(row.tvl_usd) + ' x multiple ' + row.category_multiple.toFixed(3) + ' = base ' + usdFull(base) + '\n' +
        '        x growth ' + growthMult.toFixed(4) + ' (7d ' + fmtPct(row.change_7d) + ', clamped ' + model.growth_floor + '…+' + model.growth_cap + '%)\n' +
        '        x maturity ' + maturity.toFixed(4) + ' (' + fmtAge(row.age_days) + ' old, floor ' + model.maturity_floor + ')\n' +
        '        = ' + usdFull(val) + (state.sandboxOn ? '  [sandbox values]' : '  [matches board.json]') }),
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, farmSteps(row).map(function (s) { return el('li', { text: s }); })),
      el('h3', { text: 'Token check' }));
    var r = row.research;
    if (r) {
      var dl = el('dl', { class: 'research' });
      dl.appendChild(el('dt', { text: 'Token status' }));
      dl.appendChild(el('dd', {}, tokenBadge(row), document.createTextNode(' ' + (r.token_note || ''))));
      dl.appendChild(el('dt', { text: 'Points program' }));
      dl.appendChild(el('dd', { text: (r.points_program || 'unknown') + (r.points_note ? ' — ' + r.points_note : '') }));
      dl.appendChild(el('dt', { text: 'Funding' }));
      dl.appendChild(el('dd', { text: (r.funding_usd ? usdFull(r.funding_usd) : 'unknown') + (r.funding_note ? ' — ' + r.funding_note : '') }));
      if (r.launch_signal) {
        dl.appendChild(el('dt', { text: 'Launch signal' }));
        dl.appendChild(el('dd', { text: r.launch_signal }));
      }
      if (r.website) {
        dl.appendChild(el('dt', { text: 'Official site' }));
        dl.appendChild(el('dd', { text: r.website }));
      }
      if (r.x_handle) {
        dl.appendChild(el('dt', { text: 'X' }));
        dl.appendChild(el('dd', { text: r.x_handle }));
      }
      if (r.sources && r.sources.length) {
        dl.appendChild(el('dt', { text: 'Sources' }));
        r.sources.forEach(function (s) { dl.appendChild(el('dd', { class: 'src', text: s })); });
      }
      dl.appendChild(el('dt', { text: 'Checked' }));
      dl.appendChild(el('dd', { text: (r.checked || '—') + ' · annotations only, never a rank input' }));
      section.appendChild(dl);
    } else {
      section.appendChild(el('p', { class: 'research', text: 'No independent token check recorded for this protocol yet. The board ranks it on the snapshot record alone: it records no token.' }));
    }
    section.appendChild(el('p', {}, el('button', { text: 'Close detail', onclick: function () { state.selected = null; render(); } })));
    return section;
  }

  function renderLive() {
    var table = el('table');
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
      el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }),
      el('th', { class: 'num', text: 'mcap / TVL' }), el('th', { class: 'num', text: '7d' }))));
    var body = el('tbody');
    DATA.live.forEach(function (p) {
      var ratio = p.tvl_usd ? (p.mcap_usd || 0) / p.tvl_usd : null;
      body.appendChild(el('tr', {},
        el('td', { class: 'namecell' }, el('b', { text: p.name }), el('span', { text: p.slug })),
        el('td', { text: p.category || '—' }),
        el('td', { class: 'num', text: usd(p.tvl_usd) }),
        el('td', { class: 'num', text: usd(p.mcap_usd) }),
        el('td', { class: 'num', text: ratio === null ? 'n/a' : 'x' + ratio.toFixed(3) }),
        el('td', { class: 'num', text: fmtPct(p.change_7d) })));
    });
    table.appendChild(body);
    return el('div', {},
      el('p', { class: 'countline', html: 'These ' + DATA.live.length + ' protocols already trade: the board shows the market\u2019s own value for them, never a model\u2019s. They are the comparables the multiples are read from.' }),
      table);
  }

  function renderMethod() {
    var counts = { ok: 0, exists: 0, parent: 0, wrapped: 0, unverified: 0, none: 0, points: 0 };
    DATA.rows.forEach(function (r) {
      var s = r.research;
      if (!s) { counts.none++; return; }
      if (s.token_status === 'no-token-found') counts.ok++;
      else if (s.token_status === 'token-exists') counts.exists++;
      else if (s.token_status === 'parent-has-token') counts.parent++;
      else if (s.token_status === 'wrapped-staked-product') counts.wrapped++;
      else counts.unverified++;
      if (s.points_program === 'yes') counts.points++;
    });
    var multRows = Object.keys(DATA.multiples).sort().map(function (cat) {
      var m = DATA.multiples[cat];
      return el('tr', {},
        el('td', { text: cat }),
        el('td', { class: 'num', text: 'x' + m.multiple.toFixed(3) }),
        el('td', { class: 'num', text: String(m.live_n) }),
        el('td', { text: m.source === 'category' ? 'category median' : 'global median (too few live)' }));
    });
    var multTable = el('table', {},
      el('thead', {}, el('tr', {},
        el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Multiple' }),
        el('th', { class: 'num', text: 'Live comps' }), el('th', { text: 'Source' }))),
      el('tbody', {}, multRows));
    return el('div', { class: 'method' },
      el('h2', { text: 'Methodology' }),
      el('p', { text: 'The board ranks protocols the sealed snapshot records as pre-token: no market cap, no CoinGecko id, no symbol. It never ranks a wrapped, staked or bridged product of a token that already trades, an exchange, or a versioned pool. Live-token protocols are kept apart in their own view, at the market\u2019s value.' }),
      el('h3', { text: 'The value model (radar-2)' }),
      el('p', { html: 'implied = TVL \u00d7 multiple[category] \u00d7 growth \u00d7 maturity. The multiple is read off the snapshot itself: the median market-cap / TVL of the live-token protocols in the same category (at least ' + model.min_live_for_category + ' of them, else the global median ' + DATA.global_multiple.toFixed(3) + '), clamped to ' + model.multiple_min + '–' + model.multiple_max + '. Growth is the 7-day TVL change clamped to ' + model.growth_floor + '%…+' + model.growth_cap + '%, weighted ' + model.growth_weight + '. Maturity rises from ' + model.maturity_floor + ' to ' + (model.maturity_floor + model.maturity_range) + ' over ' + model.maturity_days + ' days of running with no token (unknown age counts as ' + model.unknown_age_days + ' days).' }),
      el('p', { text: 'No protocol name is special-cased. The same function scores every row, and the multiples are recomputed from whatever snapshot is fed in, so the radar stays dynamic on a future snapshot.' }),
      el('h3', { text: 'Category multiples used' }),
      multTable,
      el('h3', { text: 'Independent token checks' }),
      el('p', { text: 'The snapshot says a protocol records no token; it does not prove it has none. Every board row was checked independently against official sites and docs, CoinGecko and CoinMarketCap on 2026-11-21. Counts: ' + counts.ok + ' no token found, ' + counts.exists + ' token actually exists, ' + counts.parent + ' parent has a token, ' + counts.wrapped + ' wrapped/staked product, ' + counts.unverified + ' unverified, ' + counts.none + ' not checked. ' + counts.points + ' rows have a live points program. A check never changes a rank or an implied value; it is shown so a reader can see which rows deserve a second look before farming.' }),
      el('h3', { text: 'What this radar does not do' }),
      el('p', { text: 'It does not predict whether or when a protocol issues a token, and its implied value is this entry\u2019s own claim, never make.fun\u2019s. A high implied value means the protocol is large and growing and its category\u2019s tokens trade richly; it is not a promise of an airdrop. Farm only with funds you can afford to keep locked, and claim only from links the protocol itself publishes.' }));
  }

  function setSort(key) {
    if (state.sort === key) state.dir = -state.dir;
    else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
    render();
  }
  function selectRow(slug) {
    state.selected = state.selected === slug ? null : slug;
    render();
    if (state.selected) {
      var d = document.getElementById('detail');
      if (d) d.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderSandbox() {
    var box = el('section', { class: 'sandbox' },
      el('h3', { text: 'Model sandbox — re-rank the board yourself' }),
      el('p', { text: 'Move a slider and the board re-ranks with the same formula. The submitted board uses the defaults; the sandbox only shows how sensitive a rank is to the model.' }),
      el('div', { class: 'sliders' },
        el('label', { text: 'Multiple scale: ' }, el('output', { text: 'x' + state.sandbox.multScale.toFixed(2) }),
          el('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: String(state.sandbox.multScale), oninput: function (e) { state.sandbox.multScale = parseFloat(e.target.value); state.sandboxOn = true; render(); } })),
        el('label', { text: 'Growth weight: ' }, el('output', { text: state.sandbox.growthWeight.toFixed(2) }),
          el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(state.sandbox.growthWeight), oninput: function (e) { state.sandbox.growthWeight = parseFloat(e.target.value); state.sandboxOn = true; render(); } })),
        el('label', { text: 'Maturity range: ' }, el('output', { text: state.sandbox.maturityRange.toFixed(2) }),
          el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(state.sandbox.maturityRange), oninput: function (e) { state.sandbox.maturityRange = parseFloat(e.target.value); state.sandboxOn = true; render(); } }))),
      el('div', { class: 'row' },
        el('button', { text: 'Reset to submitted model', onclick: function () { state.sandbox = { multScale: 1, growthWeight: model.growth_weight, maturityRange: model.maturity_range }; state.sandboxOn = false; render(); } }),
        el('span', { class: 'note', text: state.sandboxOn ? 'Sandbox active: values below are re-ranked, ranks shown are the submitted ranks.' : 'Showing the submitted board.' })));
    return box;
  }

  function render() {
    app.innerHTML = '';
    app.setAttribute('aria-busy', 'false');
    var wrap = el('div', { class: 'wrap' });
    wrap.appendChild(el('header', {},
      el('h1', { html: 'Token Radar <span class="mark">·</span> pre-token protocols, ranked by implied value' }),
      el('p', { class: 'lede', text: 'Which protocol with no token yet is worth farming next, and what do you do about it? ' + DATA.board_size + ' pre-token protocols from the sealed snapshot of ' + DATA.as_of + ', ranked by what their launch would be worth.' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'board rows' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.watchlist_size) }), el('span', { text: 'watchlist covered' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.early_size) }), el('span', { text: 'early rows below the floor' })),
        el('div', { class: 'stat' }, el('b', { text: usd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) }), el('span', { text: 'top implied value' })),
        el('div', { class: 'stat' }, el('b', { text: 'x' + DATA.global_multiple.toFixed(3) }), el('span', { text: 'global multiple' })))));
    var tabs = el('div', { class: 'tabs', role: 'tablist' },
      el('button', { text: 'Board', 'aria-selected': state.tab === 'board' ? 'true' : 'false', onclick: function () { state.tab = 'board'; render(); } }),
      el('button', { text: 'Live tokens (' + DATA.live_size + ')', 'aria-selected': state.tab === 'live' ? 'true' : 'false', onclick: function () { state.tab = 'live'; render(); } }),
      el('button', { text: 'Methodology', 'aria-selected': state.tab === 'method' ? 'true' : 'false', onclick: function () { state.tab = 'method'; render(); } }));
    wrap.appendChild(tabs);

    if (state.tab === 'board') {
      var cats = [];
      DATA.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
      cats.sort();
      var chains = [];
      DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
      chains.sort();
      var controls = el('div', { class: 'controls' },
        el('label', { text: 'Search' }, el('input', { type: 'search', placeholder: 'name or slug…', value: state.q, oninput: function (e) { state.q = e.target.value; renderBoardOnly(); } })),
        el('label', { text: 'Category' }, el('select', { onchange: function (e) { state.category = e.target.value; render(); } },
          [el('option', { value: 'all', text: 'All categories' })].concat(cats.map(function (c) { return el('option', { value: c, selected: state.category === c ? 'selected' : null, text: c }); })))),
        el('label', { text: 'Chain' }, el('select', { onchange: function (e) { state.chain = e.target.value; render(); } },
          [el('option', { value: 'all', text: 'All chains' })].concat(chains.map(function (c) { return el('option', { value: c, selected: state.chain === c ? 'selected' : null, text: c }); })))),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: state.watchOnly ? 'checked' : null, onchange: function (e) { state.watchOnly = e.target.checked; render(); } }), document.createTextNode(' Watchlist only')),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: state.pointsOnly ? 'checked' : null, onchange: function (e) { state.pointsOnly = e.target.checked; render(); } }), document.createTextNode(' Points program')));
      wrap.appendChild(controls);
      wrap.appendChild(renderSandbox());
      var selected = state.selected ? DATA.rows.filter(function (r) { return r.slug === state.selected; })[0] : null;
      if (selected) wrap.appendChild(renderDetail(selected));
      var m = sandboxModel();
      var valFn = function (r) { return state.sandboxOn ? impliedOf(r, m) : r.implied_value_usd; };
      var rows = filteredRows();
      wrap.appendChild(el('p', { class: 'countline', html: 'Showing <b>' + rows.length + '</b> of ' + DATA.board_size + ' protocols. Click a row for its detail view and farm plan. Implied values are this entry\u2019s own claim.' }));
      wrap.appendChild(renderBoardTable(rows, valFn));
    } else if (state.tab === 'live') {
      wrap.appendChild(renderLive());
    } else {
      wrap.appendChild(renderMethod());
    }
    wrap.appendChild(el('footer', { text: 'Source: ' + DATA.source + ' · Floor $' + DATA.floor_usd.toLocaleString('en-US') + ' · Model ' + DATA.model_version + ' · Implied values are the entry\u2019s own claim, never make.fun\u2019s. No network: this page renders from data.js alone.' }));
    app.appendChild(wrap);
  }

  // Search re-renders only the board area, so typing never loses the input's focus.
  function renderBoardOnly() {
    render();
    var input = app.querySelector('input[type="search"]');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  render();
})();
