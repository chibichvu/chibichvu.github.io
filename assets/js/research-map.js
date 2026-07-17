// Research Map — force-directed knowledge graph (D3 v7, no build step)
// Data lives in assets/data/research-map.json; regenerate it when the CV
// or Google Scholar profile changes and the map updates automatically.
(async function () {
  var res = await fetch('assets/data/research-map.json');
  var data = await res.json();

  var cats = data.categories;
  var papers = data.papers;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----- meta line -----
  var meta = document.getElementById('map-meta');
  if (meta) {
    meta.textContent = 'Last updated ' + data.generated + ' \u00B7 Sources: ' + data.source;
  }

  // ----- sizing -----
  var svg = d3.select('#graph');
  var wrap = document.querySelector('.map-wrap');
  var width = wrap.clientWidth;
  var height = document.getElementById('graph').clientHeight || 640;
  svg.attr('viewBox', [0, 0, width, height]);

  var nodes = data.nodes.map(function (n) { return Object.assign({}, n); });
  var links = data.links.map(function (l) { return Object.assign({}, l); });

  function radius(n) {
    if (n.cat === 'researcher') return 34;
    var base = n.cat === 'theme' ? 14 : n.cat === 'collaborator' ? 6 : 9;
    return base + Math.sqrt(n.papers.length) * 4;
  }

  var sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(function (l) {
      return (l.source.cat === 'researcher' || l.target.cat === 'researcher') ? 150 : 90;
    }).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-320))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(function (d) { return radius(d) + 14; }));

  var g = svg.append('g');

  var link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#000')
    .attr('stroke-opacity', 0.14)
    .attr('stroke-width', 1.2);

  var node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer');

  node.append('circle')
    .attr('r', radius)
    .attr('fill', function (d) { return cats[d.cat].color; })
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5);

  node.append('text')
    .text(function (d) { return d.label; })
    .attr('text-anchor', 'middle')
    .attr('dy', function (d) { return radius(d) + 15; })
    .attr('font-family', "'IBM Plex Mono', monospace")
    .attr('font-size', function (d) { return d.cat === 'researcher' ? 14 : d.cat === 'theme' ? 12 : 10.5; })
    .attr('font-weight', function (d) { return d.cat === 'researcher' || d.cat === 'theme' ? 600 : 400; })
    .attr('fill', '#000')
    .attr('paint-order', 'stroke')
    .attr('stroke', '#fff')
    .attr('stroke-width', 3.5);

  // ----- adjacency for hover highlight -----
  var adj = {};
  links.forEach(function (l) {
    var s = l.source.id, t = l.target.id;
    (adj[s] = adj[s] || {})[t] = 1;
    (adj[t] = adj[t] || {})[s] = 1;
  });

  function setHighlight(d) {
    node.attr('opacity', function (o) {
      return (o.id === d.id || (adj[d.id] && adj[d.id][o.id])) ? 1 : 0.18;
    });
    link.attr('stroke-opacity', function (l) {
      return (l.source.id === d.id || l.target.id === d.id) ? 0.65 : 0.05;
    }).attr('stroke', function (l) {
      return (l.source.id === d.id || l.target.id === d.id) ? cats[d.cat].color : '#000';
    }).attr('stroke-width', function (l) {
      return (l.source.id === d.id || l.target.id === d.id) ? 2 : 1.2;
    });
  }
  function clearHighlight() {
    node.attr('opacity', null);
    link.attr('stroke-opacity', 0.14).attr('stroke', '#000').attr('stroke-width', 1.2);
  }

  node.on('mouseenter', function (e, d) { setHighlight(d); })
      .on('mouseleave', clearHighlight);

  // ----- detail card -----
  var card = document.getElementById('node-card');
  var cardKind = card.querySelector('.card-kind');
  var cardTitle = card.querySelector('h4');
  var cardDesc = card.querySelector('.card-desc');
  var cardPapers = card.querySelector('.card-papers');

  node.on('click', function (e, d) {
    e.stopPropagation();
    cardKind.textContent = cats[d.cat].label;
    cardKind.style.background = cats[d.cat].color;
    cardKind.style.color = (d.cat === 'researcher' || d.cat === 'method') ? '#000' : '#fff';
    cardTitle.textContent = d.label;
    cardDesc.textContent = d.desc || '';
    cardPapers.innerHTML = '';
    (d.papers || []).slice(0, 6).forEach(function (pid) {
      var p = papers[pid];
      if (!p) return;
      var li = document.createElement('li');
      if (p.url) {
        var a = document.createElement('a');
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = p.short;
        li.appendChild(a);
      } else {
        li.textContent = p.short + ' \u00B7 ' + p.venue;
      }
      cardPapers.appendChild(li);
    });
    card.classList.add('visible');
  });

  node.on('dblclick', function (e, d) {
    e.stopPropagation();
    var withUrl = (d.papers || []).map(function (pid) { return papers[pid]; }).find(function (p) { return p && p.url; });
    if (withUrl) window.open(withUrl.url, '_blank', 'noopener');
  });

  svg.on('click', function () { card.classList.remove('visible'); });
  card.querySelector('.card-close').addEventListener('click', function () {
    card.classList.remove('visible');
  });

  // ----- drag -----
  node.call(d3.drag()
    .on('start', function (e, d) {
      if (!e.active) sim.alphaTarget(0.25).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on('drag', function (e, d) { d.fx = e.x; d.fy = e.y; })
    .on('end', function (e, d) {
      if (!e.active) sim.alphaTarget(0);
      d.fx = null; d.fy = null;
    }));

  // ----- zoom / pan -----
  svg.call(d3.zoom()
    .scaleExtent([0.35, 4])
    .filter(function (e) { return e.type !== 'dblclick'; })
    .on('zoom', function (e) { g.attr('transform', e.transform); }));

  // ----- tick -----
  sim.on('tick', function () {
    link.attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });
    node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
  });

  // Respect prefers-reduced-motion: settle the layout instantly.
  if (reduced) {
    sim.stop();
    for (var i = 0; i < 300; i++) sim.tick();
    sim.on('tick')();
  }

  // ----- legend (also filters) -----
  var legendBox = document.getElementById('legend-items');
  var hidden = {};
  Object.keys(cats).forEach(function (key) {
    var count = nodes.filter(function (n) { return n.cat === key; }).length;
    var btn = document.createElement('button');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = '<span class="swatch" style="background:' + cats[key].color + '"></span>' +
      '<span>' + cats[key].label + '</span><span class="count">' + count + '</span>';
    btn.addEventListener('click', function () {
      hidden[key] = !hidden[key];
      btn.classList.toggle('off', hidden[key]);
      btn.setAttribute('aria-pressed', hidden[key] ? 'false' : 'true');
      applyFilter();
    });
    legendBox.appendChild(btn);
  });

  function applyFilter() {
    node.attr('display', function (d) { return hidden[d.cat] ? 'none' : null; });
    link.attr('display', function (l) {
      return (hidden[l.source.cat] || hidden[l.target.cat]) ? 'none' : null;
    });
  }
})();
