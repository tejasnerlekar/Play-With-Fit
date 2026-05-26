let edge1 = null;
let start = null;
let planes = [];

let myFontKannada;
let myFontDevanagari;
let myShader;

let curFontScript = 'kn';   // 'kn' = Kannada, 'hi' = Devanagari

function getActiveFont() {
  return curFontScript === 'hi' ? myFontDevanagari : myFontKannada;
}

let words = ["This","Font","Fits","Anywhere","&","Everywhere"];
let wordIndex = 0;

// ── Global animation controls (affect ALL planes) ─────────────────
let globalSpeed     = 0.005;
let globalDirection = 1;      // 1 = forward, -1 = backward
let globalOffset    = 0;      // additive phase offset

let mode      = "select";
let animating = true;         // master on/off

// ── Export state (null when not exporting) ────────────────────────
let _exportState = null;   // { phases:[], captureCallback:fn|null }

// ── Colors ───────────────────────────────────────────────────────
let textColor     = '#000000';
let blockColors   = ['#FFE400', '#FF38B5', '#00FFB2', '#FF5C28'];
let canvasBgColor = '#0D0D0D';
let strokeColor   = '#ff0000';

let selectedPlane  = -1;
let selectedCorner = -1;

// ── Preload ───────────────────────────────────────────────────────
function preload() {
  myShader = loadShader('vert.vert', 'frag.frag',
    () => console.log("Shader loaded"),
    err => console.error("Shader error:", err)
  );
  myFontKannada = loadFont('../shared/fonts/FitKannadaVF.ttf',
    () => console.log("Kannada font loaded"),
    err => console.error("Kannada font error:", err)
  );
  myFontDevanagari = loadFont('../shared/fonts/FitDevanagariVF.ttf',
    () => console.log("Devanagari font loaded"),
    err => console.error("Devanagari font error:", err)
  );
}

function setup() {
  setAttributes('preserveDrawingBuffer', true);
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  textFont(getActiveFont());
  textureMode(NORMAL);
  initComposition();
  window.parent.postMessage({ type: 'sk03-mode', mode: 'select' }, '*');
}

function windowResized() {
  let oldW = width, oldH = height;
  resizeCanvas(windowWidth, windowHeight);
  // Scale plane corners to new canvas dimensions
  let scX = width / oldW, scY = height / oldH;
  for (let i = 0; i < planes.length; i++) {
    let p = planes[i];
    p.x1 *= scX; p.y1 *= scY;
    p.x2 *= scX; p.y2 *= scY;
    p.x3 *= scX; p.y3 *= scY;
    p.x4 *= scX; p.y4 *= scY;
  }
}

// ── One-point perspective corridor composition ────────────────────
function initComposition() {
  let W = width;
  let H = height;

  // Vanishing point at horizontal centre, 38% down
  let vx = 0.50, vy = 0.38;
  let gx = 0.04, gy = 0.04;   // near-edge gutter

  // [x1,y1, x2,y2, x3,y3, x4,y4] as W/H fractions
  // x1,y1=TL  x2,y2=BL  x3,y3=BR  x4,y4=TR
  let fr = [
    // Left wall — wide at screen edge, converges to VP
    [ gx, gy,   gx, 1-gy,   vx-0.03, vy+0.13,   vx-0.03, vy-0.05 ],
    // Right wall — mirror
    [ vx+0.03, vy-0.05,   vx+0.03, vy+0.13,   1-gx, 1-gy,   1-gx, gy ],
    // Floor — wide at bottom, converges to VP
    [ vx-0.03, vy+0.13,   gx, 1-gy,   1-gx, 1-gy,   vx+0.03, vy+0.13 ],
    // Ceiling — wide at top, converges to VP
    [ gx, gy,   vx-0.03, vy-0.05,   vx+0.03, vy-0.05,   1-gx, gy ],
    // Back wall — small rectangle at the vanishing point
    [ vx-0.03, vy-0.05,   vx-0.03, vy+0.13,   vx+0.03, vy+0.13,   vx+0.03, vy-0.05 ],
  ];

  for (let i = 0; i < fr.length; i++) {
    let f     = fr[i];
    let word  = words[i % words.length];
    let bgCol = blockColors[i % blockColors.length];
    let tex   = makeTextTexture(word, textColor, bgCol).get();
    planes.push({
      x1: f[0]*W, y1: f[1]*H,
      x2: f[2]*W, y2: f[3]*H,
      x3: f[4]*W, y3: f[5]*H,
      x4: f[6]*W, y4: f[7]*H,
      word,
      bgCol,
      tex,
      phase:     random(0, 1),  // stagger so planes aren't in lockstep
      offset:    0,
      animating: true
    });
  }
  wordIndex = fr.length;
}

// ── Draw ──────────────────────────────────────────────────────────
function draw() {
  let bg = parseHex(canvasBgColor);
  background(bg[0], bg[1], bg[2]);
  translate(-width / 2, -height / 2);

  for (let i = 0; i < planes.length; i++) {
    let p = planes[i];

    if (_exportState) {
      // Export mode: offsets were set by captureFrame() — don't touch them
    } else if (animating && p.animating) {
      p.phase  += globalSpeed;
      p.offset  = p.phase * globalDirection + globalOffset;
    } else {
      // Global off OR per-plane off → word centred (offset 0, centred texture)
      p.offset = 0;
    }

    drawQuad(p);

    let sc = parseHex(strokeColor);
    stroke(sc[0], sc[1], sc[2]);
    noFill();
    quad(p.x1, p.y1, p.x2, p.y2, p.x3, p.y3, p.x4, p.y4);

    if (mode === "select") {
      drawHandles(p, i === selectedPlane);
    }
  }

  if (mode === "draw") {
    if (edge1) { stroke(0,255,0); line(edge1.x1,edge1.y1,edge1.x2,edge1.y2); }
    if (start) { stroke(255);     line(start.x, start.y, mouseX, mouseY); }
  }

  // ── Export capture — readPixels here, INSIDE draw, before frame swap ──
  if (_exportState && _exportState.captureCallback) {
    let cb = _exportState.captureCallback;
    _exportState.captureCallback = null;
    let gl = drawingContext;
    let W  = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    let raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    // WebGL returns rows bottom-to-top — flip vertically
    let out  = new Uint8Array(W * H * 4);
    let rowB = W * 4;
    for (let y = 0; y < H; y++)
      out.set(raw.subarray((H - 1 - y) * rowB, (H - y) * rowB), y * rowB);
    cb(out, W, H);
  }
}

// ── Input ─────────────────────────────────────────────────────────
function mousePressed() {
  if (mode === "draw") {
    start = createVector(mouseX, mouseY);
  } else {
    selectPlane();
    notifySelection();
  }
}

function mouseDragged() {
  if (mode === "select" && selectedPlane !== -1) {
    let p = planes[selectedPlane];
    if (selectedCorner === 0) { p.x1 = mouseX; p.y1 = mouseY; }
    if (selectedCorner === 1) { p.x2 = mouseX; p.y2 = mouseY; }
    if (selectedCorner === 2) { p.x3 = mouseX; p.y3 = mouseY; }
    if (selectedCorner === 3) { p.x4 = mouseX; p.y4 = mouseY; }
  }
}

function mouseReleased() {
  if (mode === "draw" && start) {
    let end     = createVector(mouseX, mouseY);
    let newEdge = { x1: start.x, y1: start.y, x2: end.x, y2: end.y };

    if (!edge1) {
      edge1 = newEdge;
    } else {
      let mid1 = (edge1.x1 + edge1.x2) / 2;
      let mid2 = (newEdge.x1 + newEdge.x2) / 2;
      let L    = mid1 < mid2 ? edge1 : newEdge;
      let R    = mid1 < mid2 ? newEdge : edge1;

      let word  = words[wordIndex % words.length];
      let bgCol = blockColors[wordIndex % blockColors.length];
      let tex   = makeTextTexture(word, textColor, bgCol).get();

      planes.push({
        x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2,
        x3: R.x2, y3: R.y2, x4: R.x1, y4: R.y1,
        word, bgCol, tex,
        phase: 0, offset: 0, animating: true
      });
      wordIndex++;
      edge1 = null;
    }
    start = null;
  }
  selectedCorner = -1;
}

function keyPressed() {
  if (key === 'd' || key === 'D') {
    mode = "draw";
    selectedPlane = -1;
    notifySelection();
    window.parent.postMessage({ type: 'sk03-mode', mode: 'draw' }, '*');
  }
  if (key === 's' || key === 'S') {
    mode = "select";
    window.parent.postMessage({ type: 'sk03-mode', mode: 'select' }, '*');
  }
}

// ── Selection ─────────────────────────────────────────────────────
function selectPlane() {
  let threshold  = 20;
  selectedPlane  = -1;
  selectedCorner = -1;

  for (let i = 0; i < planes.length; i++) {
    let p       = planes[i];
    let corners = [[p.x1,p.y1],[p.x2,p.y2],[p.x3,p.y3],[p.x4,p.y4]];
    for (let j = 0; j < 4; j++) {
      if (dist(mouseX, mouseY, corners[j][0], corners[j][1]) < threshold) {
        selectedPlane = i; selectedCorner = j; return;
      }
    }
  }
  for (let i = planes.length - 1; i >= 0; i--) {
    if (pointInQuad(mouseX, mouseY, planes[i])) {
      selectedPlane = i; return;
    }
  }
}

function pointInQuad(px, py, p) {
  let minX = Math.min(p.x1,p.x2,p.x3,p.x4), maxX = Math.max(p.x1,p.x2,p.x3,p.x4);
  let minY = Math.min(p.y1,p.y2,p.y3,p.y4), maxY = Math.max(p.y1,p.y2,p.y3,p.y4);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

function notifySelection() {
  if (selectedPlane >= 0 && selectedPlane < planes.length) {
    let p = planes[selectedPlane];
    window.parent.postMessage({
      type: 'sk03-select', idx: selectedPlane,
      bgCol: p.bgCol, animating: p.animating
    }, '*');
  } else {
    window.parent.postMessage({ type: 'sk03-deselect' }, '*');
  }
}

// ── Render ────────────────────────────────────────────────────────
function drawHandles(p, active) {
  let corners = [[p.x1,p.y1],[p.x2,p.y2],[p.x3,p.y3],[p.x4,p.y4]];
  noStroke();
  for (let i = 0; i < 4; i++) {
    fill(active ? color(255,255,0) : color(255,255,255,160));
    circle(corners[i][0], corners[i][1], active ? 14 : 9);
  }
}

function drawQuad(p) {
  shader(myShader);
  texture(p.tex);
  myShader.setUniform('uOffset', p.offset);
  noStroke();

  function interp(u, v) {
    return {
      x: (1-u)*(1-v)*p.x1 + u*(1-v)*p.x4 + u*v*p.x3 + (1-u)*v*p.x2,
      y: (1-u)*(1-v)*p.y1 + u*(1-v)*p.y4 + u*v*p.y3 + (1-u)*v*p.y2
    };
  }

  let cols = 32, rows = 32;
  beginShape(TRIANGLES);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let u1=i/cols,u2=(i+1)/cols,v1=j/rows,v2=(j+1)/rows;
      let a=interp(u1,v1),b=interp(u2,v1),c=interp(u2,v2),d=interp(u1,v2);
      vertex(a.x,a.y,u1,v1); vertex(b.x,b.y,u2,v1); vertex(c.x,c.y,u2,v2);
      vertex(a.x,a.y,u1,v1); vertex(c.x,c.y,u2,v2); vertex(d.x,d.y,u1,v2);
    }
  }
  endShape();
  resetShader();
}

// Texture: word CENTRED so offset=0 shows it centred in the quad when stopped
function makeTextTexture(word, textCol, bgCol) {
  let textSz = 400;
  let wordH  = 550;
  let margin = 30;

  let temp = createGraphics(10, 10);
  temp.pixelDensity(1);
  temp.textFont(getActiveFont());
  temp.textSize(textSz);
  let tw = temp.textWidth(word);
  temp.remove();

  let texW = tw   + margin * 2;
  let texH = wordH + margin * 2;

  let g  = createGraphics(texW, texH);
  g.pixelDensity(1);
  let bc = parseHex(bgCol   || '#FFE400');
  let tc = parseHex(textCol || '#000000');
  g.background(bc[0], bc[1], bc[2]);
  g.fill(tc[0], tc[1], tc[2]);
  g.textFont(getActiveFont());
  g.textSize(textSz);
  g.textAlign(CENTER, CENTER);   // centred so offset=0 → word centred
  g.text(word, texW / 2, texH / 2);
  return g;
}

function rebakeAll() {
  for (let i = 0; i < planes.length; i++) {
    let p = planes[i];
    p.tex = makeTextTexture(p.word, textColor, p.bgCol).get();
  }
}

function parseHex(hex) {
  hex = (hex || '#000000').replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

// ── Control API ───────────────────────────────────────────────────
window.sk03 = {
  setMode: function(m) {
    mode = m;
    if (m === 'draw') { selectedPlane = -1; notifySelection(); }
  },

  // Master toggle
  setAnimating: function(v) { animating = v; },

  // Global scroll controls — affect all planes immediately
  setSpeed:     function(s) { globalSpeed     = s; },
  setDirection: function(d) { globalDirection = d; },
  setOffset:    function(o) { globalOffset    = o; },

  // Script switch — changes font and optionally words, then rebakes all planes.
  // Fonts are already pre-loaded in preload(), so no async waiting needed.
  setScript: function(sc, arr) {
    curFontScript = sc;
    if (arr && arr.length) words = arr.slice();
    for (var i = 0; i < planes.length; i++) {
      planes[i].word = words[i % words.length];
      planes[i].tex  = makeTextTexture(planes[i].word, textColor, planes[i].bgCol).get();
    }
    wordIndex = planes.length;
  },

  // Words → rebake all planes
  setWords: function(arr) {
    words = arr.length ? arr : ["Fit"];
    for (let i = 0; i < planes.length; i++) {
      planes[i].word = words[i % words.length];
      planes[i].tex  = makeTextTexture(planes[i].word, textColor, planes[i].bgCol).get();
    }
    wordIndex = planes.length;
  },

  setTextColor:  function(c) { textColor = c; rebakeAll(); },
  setBlockColors: function(arr) {
    blockColors = arr;
    for (let i = 0; i < planes.length; i++) planes[i].bgCol = blockColors[i % blockColors.length];
    rebakeAll();
  },
  setCanvasBg:    function(c) { canvasBgColor = c; },
  setStrokeColor: function(c) { strokeColor   = c; },

  // Per-plane (selected block only)
  setSelectedColor: function(idx, c) {
    if (idx < 0 || idx >= planes.length) return;
    planes[idx].bgCol = c;
    planes[idx].tex   = makeTextTexture(planes[idx].word, textColor, c).get();
  },
  setSelectedAnim: function(idx, v) {
    if (idx < 0 || idx >= planes.length) return;
    planes[idx].animating = v;
    if (!v) { planes[idx].phase = 0; planes[idx].offset = 0; }
  },

  clear: function() {
    planes = []; edge1 = null; start = null; wordIndex = 0;
    selectedPlane = -1; notifySelection();
  },

  // Called by parent after iframe first loads to ensure canvas fills correctly.
  // p5 only resets the WebGL viewport when dimensions actually change, so if
  // setup() happened to use the right size, windowResized() is a no-op and the
  // GL state stays broken.  Force a genuine resize cycle with a 1-px nudge so
  // the renderer always resets, then restore the real size.
  triggerResize: function() {
    let w = windowWidth, h = windowHeight;
    if (w <= 0 || h <= 0) return;
    if (w !== width || h !== height) {
      // Canvas was created at wrong size → resize and reinit the composition
      resizeCanvas(w, h);
      planes = []; edge1 = null; start = null; wordIndex = 0; selectedPlane = -1;
      initComposition();
    } else {
      // Canvas size is already correct but GL viewport may not be set up —
      // force the renderer to do a real resize by briefly using different dims.
      resizeCanvas(w + 1, h + 1);
      resizeCanvas(w, h);
    }
  },

  // ── Export support ────────────────────────────────────────────────
  // beginExport() — snapshots plane phases, returns timing for one full loop.
  beginExport: function() {
    _exportState = { phases: planes.map(p => p.phase), captureCallback: null };
    return {
      durationMs:    1000 / (globalSpeed * 60),  // one full cycle at current speed
      speedPerFrame: globalSpeed
    };
  },

  // captureFrame(phaseStep) — sets offsets for this frame, returns a Promise
  // that resolves with { pixels:Uint8Array, w, h } read from inside p5's draw.
  captureFrame: function(phaseStep) {
    let st = _exportState;
    // Apply offsets immediately so next draw uses them
    for (let i = 0; i < planes.length; i++) {
      planes[i].offset = planes[i].animating
        ? (st.phases[i] + phaseStep) * globalDirection + globalOffset
        : 0;
    }
    return new Promise(resolve => {
      st.captureCallback = (pixels, w, h) => resolve({ pixels, w, h });
    });
  },

  // endExport() — restores plane phases and clears export state.
  endExport: function() {
    if (_exportState) {
      _exportState.phases.forEach((ph, i) => { if (planes[i]) planes[i].phase = ph; });
      _exportState = null;
    }
  },

  // Tutorial helper — programmatically add an edge (or complete a plane from two edges).
  // Called by the ghost-cursor overlay in index.html without needing real mouse events.
  _tutAddEdge: function(x1, y1, x2, y2) {
    var newEdge = { x1:x1, y1:y1, x2:x2, y2:y2 };
    if (!edge1) {
      edge1 = newEdge;
    } else {
      var mid1 = (edge1.x1 + edge1.x2) / 2;
      var mid2 = (newEdge.x1 + newEdge.x2) / 2;
      var L    = mid1 < mid2 ? edge1 : newEdge;
      var R    = mid1 < mid2 ? newEdge : edge1;
      var w    = words[wordIndex % words.length];
      var bg   = blockColors[wordIndex % blockColors.length];
      var tx   = makeTextTexture(w, textColor, bg).get();
      planes.push({
        x1:L.x1, y1:L.y1, x2:L.x2, y2:L.y2,
        x3:R.x2, y3:R.y2, x4:R.x1, y4:R.y1,
        word:w, bgCol:bg, tex:tx, phase:0, offset:0, animating:true
      });
      wordIndex++;
      edge1 = null;
    }
  }
};
