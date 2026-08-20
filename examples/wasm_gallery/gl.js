// The same frame, on the GPU.
//
// The page next door walks the number block and calls canvas2d once per box
// and once per line: three hundred and fifty calls for a screen, which is
// most of what a frame costs once the layout is cheap. Here the block goes
// almost straight to the card.
//
// ONE shape does nearly everything. A rounded box with four corner radii is
// a signed distance field; so is the clip it sits inside; so is a ring, and
// so is a letter once the letter is a picture in an atlas. So there is one
// vertex buffer (a unit quad), one instance buffer (twenty four numbers a
// thing), and one draw call - and because a draw call rasterises its
// instances in order, painting order comes out right without sorting or
// depth.
//
// What breaks the single call is a polygon, which is not a box. Those flush
// the batch, draw, and let the batch start again. A screen has four.

function makeGl(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return null;

  const VERT = `#version 300 es
  layout(location=0) in vec2 a_at;          // the unit quad
  layout(location=1) in vec4 i_box;         // x y w h
  layout(location=2) in vec4 i_radii;       // tl tr br bl
  layout(location=3) in vec4 i_ink;         // r g b a
  layout(location=4) in vec4 i_clip;        // x y w h
  layout(location=5) in vec4 i_more;        // clip radius | softness | kind | thickness
  layout(location=6) in vec4 i_uv;          // u0 v0 u1 v1, or an angle pair for a ring
  uniform vec2 u_screen;
  out vec2 v_at;                            // where in the box this pixel is
  out vec4 v_box; out vec4 v_radii; out vec4 v_ink; out vec4 v_clip; out vec4 v_more; out vec4 v_uv;
  out vec2 v_uvAt;
  void main() {
    // A soft edge needs room to fade in, so the quad grows by the softness.
    float pad = max(i_more.y, 1.0);
    vec2 pos = i_box.xy - pad + a_at * (i_box.zw + pad * 2.0);
    v_at = pos;
    v_box = i_box; v_radii = i_radii; v_ink = i_ink; v_clip = i_clip; v_more = i_more; v_uv = i_uv;
    v_uvAt = mix(i_uv.xy, i_uv.zw, a_at);
    gl_Position = vec4(pos / u_screen * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
  }`;

  const FRAG = `#version 300 es
  precision highp float;
  in vec2 v_at;
  in vec4 v_box; in vec4 v_radii; in vec4 v_ink; in vec4 v_clip; in vec4 v_more; in vec4 v_uv;
  in vec2 v_uvAt;
  uniform sampler2D u_atlas;
  out vec4 colour;

  // Distance from a point to a rounded box, negative inside. The corner is
  // picked by which quarter of the box the point is in.
  float boxAway(vec2 at, vec4 box, vec4 radii) {
    vec2 mid = box.xy + box.zw * 0.5;
    vec2 half_ = box.zw * 0.5;
    vec2 d = at - mid;
    float r = d.x > 0.0 ? (d.y > 0.0 ? radii.z : radii.y) : (d.y > 0.0 ? radii.w : radii.x);
    r = min(r, min(half_.x, half_.y));
    vec2 q = abs(d) - half_ + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    float kind = v_more.z;
    float cover;
    if (kind > 1.5 && kind < 2.5) {
      // A ring: the distance to a circle of the right radius, cut to the
      // slice between two angles.
      vec2 mid = v_box.xy + v_box.zw * 0.5;
      vec2 d = v_at - mid;
      float ring = abs(length(d) - v_radii.x) - v_more.w * 0.5;
      float turn = atan(d.x, -d.y);
      if (turn < 0.0) turn += 6.2831853;
      float inside = (turn >= v_uv.x && turn <= v_uv.y) ? 1.0 : 0.0;
      float aa = fwidth(ring);
      cover = (1.0 - smoothstep(-aa, aa, ring)) * inside;
    } else {
      float away = boxAway(v_at, v_box, v_radii);
      // How far one pixel reaches, asked of the card rather than assumed, so
      // the edge is the same on a retina screen as on a plain one. A shadow
      // says how far it wants to fade and wins over that.
      float soft = max(v_more.y, fwidth(away));
      cover = 1.0 - smoothstep(-soft, soft, away);
    }
    if (kind > 0.5 && kind < 1.5) cover *= texture(u_atlas, v_uvAt).r;   // a letter
    // A slide of colour is the same box with a second colour riding where a
    // letter would have kept its place on the sheet.
    vec4 ink = kind > 2.5
      ? mix(v_ink, v_uv, clamp((v_at.y - v_box.y) / max(v_box.w, 1.0), 0.0, 1.0))
      : v_ink;
    float clipAway = boxAway(v_at, v_clip, vec4(v_more.x));
    float clipAa = fwidth(clipAway);
    cover *= 1.0 - smoothstep(-clipAa, clipAa, clipAway);
    if (cover <= 0.0) discard;
    colour = vec4(ink.rgb * ink.a * cover, ink.a * cover);
  }`;

  const PLAIN_VERT = `#version 300 es
  layout(location=0) in vec2 a_at;
  uniform vec2 u_screen;
  void main() { gl_Position = vec4(a_at / u_screen * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0); }`;
  const PLAIN_FRAG = `#version 300 es
  precision highp float;
  uniform vec4 u_ink;
  out vec4 colour;
  void main() { colour = vec4(u_ink.rgb * u_ink.a, u_ink.a); }`;

  const build = (vs, fs) => {
    const one = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, one(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, one(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };

  const prog = build(VERT, FRAG);
  const plain = build(PLAIN_VERT, PLAIN_FRAG);
  const uScreen = gl.getUniformLocation(prog, 'u_screen');
  const uAtlas = gl.getUniformLocation(prog, 'u_atlas');
  const pScreen = gl.getUniformLocation(plain, 'u_screen');
  const pInk = gl.getUniformLocation(plain, 'u_ink');

  // The unit quad, once.
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  const STRIDE = 24;                    // floats per instance
  let room = 4096;
  let bank = new Float32Array(room * STRIDE);
  let many = 0;
  const inst = gl.createBuffer();

  const va = gl.createVertexArray();
  gl.bindVertexArray(va);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  for (let i = 0; i < 6; i++) {
    gl.enableVertexAttribArray(1 + i);
    gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
    gl.vertexAttribDivisor(1 + i, 1);
  }
  gl.bindVertexArray(null);

  const plainVa = gl.createVertexArray();
  const plainBuf = gl.createBuffer();
  gl.bindVertexArray(plainVa);
  gl.bindBuffer(gl.ARRAY_BUFFER, plainBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // --- the letters ---------------------------------------------------------
  // Every letter at every size it is asked for, drawn once into one texture
  // with the very face the layout was measured with. A letter is then a
  // picture, and a picture is the same rounded box as everything else.
  const ATLAS = 1024;
  const shelf = document.createElement('canvas');
  shelf.width = ATLAS; shelf.height = ATLAS;
  const pen = shelf.getContext('2d', { willReadFrequently: false });
  const faces = new Map();
  let penX = 1, penY = 1, penRow = 0;
  // Which part of the sheet has changed since the card last saw it. A new
  // letter is a few hundred bytes; sending the whole megabyte for it was a
  // four millisecond hitch the first time a page showed a letter nothing
  // else had used.
  let dirty = null;
  const atlas = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlas);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, ATLAS, ATLAS, 0, gl.RED, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // A face is a font plus where the line hangs from: canvas puts words by
  // the TOP of the em box and marks by the MIDDLE, so the sheet is written
  // the same way. Then a letter goes exactly where canvas would have put it
  // and nothing has to be guessed back.
  function faceOf(font, mid) {
    const key = mid ? font + '|m' : font;
    let f = faces.get(key);
    if (!f) { f = { glyphs: new Map(), rows: new Map(), font: font, mid: !!mid }; faces.set(key, f); }
    return f;
  }

  function glyphOf(face, ch) {
    let g = face.glyphs.get(ch);
    if (g) return g;
    pen.font = face.font;
    pen.textBaseline = face.mid ? 'middle' : 'top';
    pen.textAlign = face.mid ? 'center' : 'left';
    const m = pen.measureText(ch);
    // All four are measured from the very anchor the letter will be drawn
    // from, so the box below is where the ink lands, and nothing else.
    const left = Math.ceil(m.actualBoundingBoxLeft) + 2;
    const up = Math.ceil(m.actualBoundingBoxAscent) + 2;
    const w = left + Math.ceil(m.actualBoundingBoxRight) + 2;
    const h = up + Math.ceil(m.actualBoundingBoxDescent) + 2;
    if (w <= 0 || h <= 0) { g = { w: 0, advance: m.width }; face.glyphs.set(ch, g); return g; }
    if (penX + w >= ATLAS) { penX = 1; penY += penRow + 1; penRow = 0; }
    // The sheet is full. Every letter on it is now in the wrong place, so
    // every face forgets its letters.
    if (penY + h >= ATLAS) {
      for (const f of faces.values()) { f.glyphs.clear(); f.rows.clear(); }
      penX = 1; penY = 1; penRow = 0; pen.clearRect(0, 0, ATLAS, ATLAS);
      dirty = [0, 0, ATLAS, ATLAS];
    }
    pen.clearRect(penX, penY, w, h);
    pen.fillStyle = '#fff';
    pen.fillText(ch, penX + left, penY + up);
    g = { x0: penX, w: w, h: h, dx: -left, dy: -up, advance: m.width,
          u0: penX / ATLAS, v0: penY / ATLAS, u1: (penX + w) / ATLAS, v1: (penY + h) / ATLAS };
    face.glyphs.set(ch, g);
    penX += w + 1;
    if (h > penRow) penRow = h;
    dirty = dirty
      ? [Math.min(dirty[0], g.x0), Math.min(dirty[1], penY), Math.max(dirty[2], g.x0 + w), Math.max(dirty[3], penY + h)]
      : [g.x0, penY, g.x0 + w, penY + h];
    return g;
  }

  // A finished row of letters: which letters, and how far along the line
  // each one sits. The same words are drawn every frame, so this is worked
  // out once per line per face and then only walked.
  function rowFor(face, word, len) {
    const gs = [], offs = [];
    let pen = 0;
    for (const ch of word) {
      const gm = glyphOf(face, ch);
      if (gm.w > 0) { gs.push(gm); offs.push(pen); }
      pen += gm.advance;
    }
    return { len: len, gs: gs, offs: offs, n: gs.length };
  }

  function pushAtlas() {
    if (!dirty) return;
    const [x0, y0, x1, y1] = dirty;
    dirty = null;
    const w = x1 - x0, h = y1 - y0;
    const px = pen.getImageData(x0, y0, w, h).data;
    const only = new Uint8Array(w * h);
    for (let i = 0, j = 3; i < only.length; i++, j += 4) only[i] = px[j];
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, w, h, gl.RED, gl.UNSIGNED_BYTE, only);
  }

  // --- the batch -----------------------------------------------------------
  const NO_CLIP = [-1e5, -1e5, 4e5, 4e5, 0];
  let clipNow = NO_CLIP;

  function room_for(n) {
    if (many + n <= room) return;
    room = Math.max(room * 2, many + n);
    const bigger = new Float32Array(room * STRIDE);
    bigger.set(bank.subarray(0, many * STRIDE));
    bank = bigger;
  }

  function put(x, y, w, h, tl, tr, br, bl, r, g, b, a, kind, soft, thick, u0, v0, u1, v1) {
    room_for(1);
    const o = many * STRIDE;
    bank[o] = x; bank[o+1] = y; bank[o+2] = w; bank[o+3] = h;
    bank[o+4] = tl; bank[o+5] = tr; bank[o+6] = br; bank[o+7] = bl;
    bank[o+8] = r; bank[o+9] = g; bank[o+10] = b; bank[o+11] = a;
    bank[o+12] = clipNow[0]; bank[o+13] = clipNow[1]; bank[o+14] = clipNow[2]; bank[o+15] = clipNow[3];
    bank[o+16] = clipNow[4]; bank[o+17] = soft; bank[o+18] = kind; bank[o+19] = thick;
    bank[o+20] = u0; bank[o+21] = v0; bank[o+22] = u1; bank[o+23] = v1;
    many++;
  }

  function flush(screenW, screenH) {
    if (!many) return;
    pushAtlas();
    gl.useProgram(prog);
    gl.uniform2f(uScreen, screenW, screenH);
    gl.uniform1i(uAtlas, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, bank.subarray(0, many * STRIDE), gl.STREAM_DRAW);
    gl.bindVertexArray(va);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, many);
    gl.bindVertexArray(null);
    many = 0;
  }

  // A polygon is not a box, so it breaks the run: the batch so far goes out
  // first, then this, then the batch starts again. Painting order survives.
  // A screen has about four of these.
  function polygon(pts, r, g, b, a, screenW, screenH) {
    flush(screenW, screenH);
    const many_ = pts.length / 2;
    const tri = new Float32Array((many_ - 2) * 6);
    for (let i = 1, o = 0; i < many_ - 1; i++) {
      tri[o++] = pts[0]; tri[o++] = pts[1];
      tri[o++] = pts[i*2]; tri[o++] = pts[i*2+1];
      tri[o++] = pts[i*2+2]; tri[o++] = pts[i*2+3];
    }
    gl.useProgram(plain);
    gl.uniform2f(pScreen, screenW, screenH);
    gl.uniform4f(pInk, r, g, b, a);
    gl.bindVertexArray(plainVa);
    gl.bindBuffer(gl.ARRAY_BUFFER, plainBuf);
    gl.bufferData(gl.ARRAY_BUFFER, tri, gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, tri.length / 2);
    gl.bindVertexArray(null);
  }

  function begin(screenW, screenH) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    clipNow = NO_CLIP;
    many = 0;
  }

  return { gl, put, flush, begin, polygon, faceOf, glyphOf, rowFor, clip: (c) => { clipNow = c || NO_CLIP; } };
}
