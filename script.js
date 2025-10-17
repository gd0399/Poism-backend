/*
  WebGL Frustum Culling Demo
  - Minimal shader-based instanced spheres (icosphere approx) for many objects
  - Orbit camera controls
  - Extracts frustum planes from combined projection*view matrix
  - CPU-side sphere-vs-frustum culling per instance
*/

(function() {
  const canvas = document.getElementById('glcanvas');
  /** @type {WebGL2RenderingContext} */
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) {
    alert('WebGL2 unsupported');
    return;
  }

  // ---------- Utilities ----------
  function resizeCanvasToDisplaySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  // Minimal mat4/mat3/vec3 helpers (column-major)
  const Mat4 = {
    identity() {
      return new Float32Array([
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
      ]);
    },
    multiply(a, b) {
      const out = new Float32Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          out[j*4 + i] = a[i] * b[j*4] + a[4 + i] * b[j*4 + 1] + a[8 + i] * b[j*4 + 2] + a[12 + i] * b[j*4 + 3];
        }
      }
      return out;
    },
    perspective(fovyRad, aspect, near, far) {
      const f = 1.0 / Math.tan(fovyRad / 2);
      const nf = 1 / (near - far);
      const out = new Float32Array(16);
      out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
      out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
      return out;
    },
    lookAt(eye, center, up) {
      const z0 = eye[0] - center[0];
      const z1 = eye[1] - center[1];
      const z2 = eye[2] - center[2];
      let len = Math.hypot(z0, z1, z2);
      const zx = z0 / len, zy = z1 / len, zz = z2 / len;

      const x0 = up[1] * zz - up[2] * zy;
      const x1 = up[2] * zx - up[0] * zz;
      const x2 = up[0] * zy - up[1] * zx;
      len = Math.hypot(x0, x1, x2);
      const xx = x0 / len, xy = x1 / len, xz = x2 / len;

      const y0 = zy * xz - zz * xy;
      const y1 = zz * xx - zx * xz;
      const y2 = zx * xy - zy * xx;

      const out = new Float32Array(16);
      out[0] = xx; out[4] = xy; out[8] = xz; out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      out[1] = y0; out[5] = y1; out[9] = y2; out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
      out[2] = zx; out[6] = zy; out[10] = zz; out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      out[3] = 0;  out[7] = 0;  out[11] = 0;  out[15] = 1;
      return out;
    },
    invert(m) {
      const out = new Float32Array(16);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

      const b00 = a00 * a11 - a01 * a10;
      const b01 = a00 * a12 - a02 * a10;
      const b02 = a00 * a13 - a03 * a10;
      const b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11;
      const b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30;
      const b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30;
      const b09 = a21 * a32 - a22 * a31;
      const b10 = a21 * a33 - a23 * a31;
      const b11 = a22 * a33 - a23 * a32;

      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return Mat4.identity();
      det = 1.0 / det;

      out[0] = ( a11 * b11 - a12 * b10 + a13 * b09) * det;
      out[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * det;
      out[2] = ( a31 * b05 - a32 * b04 + a33 * b03) * det;
      out[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * det;
      out[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * det;
      out[5] = ( a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * det;
      out[7] = ( a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = ( a10 * b10 - a11 * b08 + a13 * b06) * det;
      out[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * det;
      out[10]= ( a30 * b04 - a31 * b02 + a33 * b00) * det;
      out[11]= (-a20 * b04 + a21 * b02 - a23 * b00) * det;
      out[12]= (-a10 * b09 + a11 * b07 - a12 * b06) * det;
      out[13]= ( a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14]= (-a30 * b03 + a31 * b01 - a32 * b00) * det;
      out[15]= ( a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    }
  };

  const Vec3 = {
    add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; },
    sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; },
    scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; },
  };

  // ---------- Shaders ----------
  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(info || 'Shader compile failed');
    }
    return shader;
  }

  function createProgram(vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(info || 'Program link failed');
    }
    return program;
  }

  const vertexSource = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 iOffset; // per-instance offset
  uniform mat4 uProjection;
  uniform mat4 uView;
  uniform float uScale;
  void main() {
    vec3 pos = aPosition * uScale + iOffset;
    gl_Position = uProjection * uView * vec4(pos, 1.0);
  }
  `;

  const fragmentSource = `#version 300 es
  precision highp float;
  out vec4 outColor;
  void main() {
    float g = 0.9;
    outColor = vec4(0.2, 0.75, 1.0, 1.0);
  }
  `;

  const vs = createShader(gl.VERTEX_SHADER, vertexSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = createProgram(vs, fs);

  const uProjectionLoc = gl.getUniformLocation(program, 'uProjection');
  const uViewLoc = gl.getUniformLocation(program, 'uView');
  const uScaleLoc = gl.getUniformLocation(program, 'uScale');

  // ---------- Geometry: Icosahedron sphere-ish (low poly) ----------
  function createIcoSphere(subdivisions = 1) {
    // Basic icosahedron vertices
    const t = (1 + Math.sqrt(5)) / 2;
    let positions = [
      -1,  t,  0,   1,  t,  0,  -1, -t,  0,   1, -t,  0,
       0, -1,  t,   0,  1,  t,   0, -1, -t,   0,  1, -t,
       t,  0, -1,   t,  0,  1,  -t,  0, -1,  -t,  0,  1,
    ];
    function normalize() {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], y = positions[i+1], z = positions[i+2];
        const l = Math.hypot(x, y, z) || 1;
        positions[i] = x / l; positions[i+1] = y / l; positions[i+2] = z / l;
      }
    }
    normalize();

    let faces = [
      0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11,
      1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8,
      3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9,
      4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1,
    ];

    function midpoint(a, b) {
      return [
        (positions[3*a] + positions[3*b]) * 0.5,
        (positions[3*a+1] + positions[3*b+1]) * 0.5,
        (positions[3*a+2] + positions[3*b+2]) * 0.5,
      ];
    }

    for (let s = 0; s < subdivisions; s++) {
      const newPositions = positions.slice();
      const newFaces = [];
      const midpointCache = new Map();
      function getMidIndex(i1, i2) {
        const key = i1 < i2 ? (i1 + '|' + i2) : (i2 + '|' + i1);
        if (midpointCache.has(key)) return midpointCache.get(key);
        const m = midpoint(i1, i2);
        const idx = newPositions.length / 3;
        const len = Math.hypot(m[0], m[1], m[2]) || 1;
        newPositions.push(m[0]/len, m[1]/len, m[2]/len);
        midpointCache.set(key, idx);
        return idx;
      }
      for (let i = 0; i < faces.length; i += 3) {
        const a = faces[i], b = faces[i+1], c = faces[i+2];
        const ab = getMidIndex(a, b);
        const bc = getMidIndex(b, c);
        const ca = getMidIndex(c, a);
        newFaces.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
      }
      positions = newPositions;
      faces = newFaces;
    }

    const vertices = new Float32Array(faces.length * 3);
    for (let i = 0; i < faces.length; i++) {
      vertices[i*3] = positions[faces[i]*3];
      vertices[i*3+1] = positions[faces[i]*3+1];
      vertices[i*3+2] = positions[faces[i]*3+2];
    }
    return vertices;
  }

  const sphereVertices = createIcoSphere(1); // light poly

  // ---------- Buffers & VAO ----------
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, sphereVertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  // Instance offsets
  const instanceCount = 2000;
  const instanceOffsets = new Float32Array(instanceCount * 3);
  const instanceRadii = new Float32Array(instanceCount);
  const grid = Math.ceil(Math.pow(instanceCount, 1/3));
  let idx = 0;
  for (let x = 0; x < grid && idx < instanceCount; x++) {
    for (let y = 0; y < grid && idx < instanceCount; y++) {
      for (let z = 0; z < grid && idx < instanceCount; z++) {
        instanceOffsets[idx*3] = (x - grid/2) * 3.2;
        instanceOffsets[idx*3+1] = (y - grid/2) * 3.2;
        instanceOffsets[idx*3+2] = (z - grid/2) * 3.2;
        instanceRadii[idx] = 0.8 + Math.random() * 0.6;
        idx++;
      }
    }
  }

  const iOffsetBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, iOffsetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, instanceOffsets, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  gl.bindVertexArray(null);

  // ---------- State ----------
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.03, 0.05, 0.12, 1.0);

  let projection = Mat4.identity();
  let view = Mat4.identity();

  // Camera params
  const cameraTarget = [0, 0, 0];
  let cameraDistance = 30;
  let cameraPhi = 0.9;   // polar
  let cameraTheta = 0.7; // azimuth

  let isDragging = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    cameraTheta -= dx * 0.005;
    cameraPhi = clamp(cameraPhi - dy * 0.005, 0.05, Math.PI - 0.05);
  });
  canvas.addEventListener('wheel', (e) => {
    cameraDistance = clamp(cameraDistance * (1 + Math.sign(e.deltaY) * 0.1), 5, 200);
  }, { passive: true });

  window.addEventListener('resize', resizeCanvasToDisplaySize);
  resizeCanvasToDisplaySize();

  // ---------- Frustum extraction ----------
  const frustumPlanes = new Float32Array(6 * 4); // each plane: [a,b,c,d]
  function extractFrustumPlanes(projection, view) {
    const combo = Mat4.multiply(projection, view); // column-major
    // Planes from combo matrix (OpenGL clip space):
    // Left:   row4 + row1
    // Right:  row4 - row1
    // Bottom: row4 + row2
    // Top:    row4 - row2
    // Near:   row4 + row3
    // Far:    row4 - row3
    function setPlane(i, a, b, c, d) {
      const len = Math.hypot(a, b, c) || 1;
      frustumPlanes[i*4+0] = a/len;
      frustumPlanes[i*4+1] = b/len;
      frustumPlanes[i*4+2] = c/len;
      frustumPlanes[i*4+3] = d/len;
    }

    const m = combo; // alias
    // rows for column-major matrix
    const r1 = [m[0], m[4], m[8],  m[12]];
    const r2 = [m[1], m[5], m[9],  m[13]];
    const r3 = [m[2], m[6], m[10], m[14]];
    const r4 = [m[3], m[7], m[11], m[15]];

    setPlane(0, r4[0] + r1[0], r4[1] + r1[1], r4[2] + r1[2], r4[3] + r1[3]); // Left
    setPlane(1, r4[0] - r1[0], r4[1] - r1[1], r4[2] - r1[2], r4[3] - r1[3]); // Right
    setPlane(2, r4[0] + r2[0], r4[1] + r2[1], r4[2] + r2[2], r4[3] + r2[3]); // Bottom
    setPlane(3, r4[0] - r2[0], r4[1] - r2[1], r4[2] - r2[2], r4[3] - r2[3]); // Top
    setPlane(4, r4[0] + r3[0], r4[1] + r3[1], r4[2] + r3[2], r4[3] + r3[3]); // Near
    setPlane(5, r4[0] - r3[0], r4[1] - r3[1], r4[2] - r3[2], r4[3] - r3[3]); // Far
  }

  function sphereInFrustum(center, radius) {
    for (let i = 0; i < 6; i++) {
      const a = frustumPlanes[i*4+0];
      const b = frustumPlanes[i*4+1];
      const c = frustumPlanes[i*4+2];
      const d = frustumPlanes[i*4+3];
      const dist = a*center[0] + b*center[1] + c*center[2] + d;
      if (dist < -radius) return false;
    }
    return true;
  }

  // ---------- UI ----------
  const cullingToggle = document.getElementById('cullingToggle');
  const visibleCountEl = document.getElementById('visibleCount');
  const totalCountEl = document.getElementById('totalCount');
  const fpsEl = document.getElementById('fps');
  totalCountEl.textContent = String(instanceCount);

  // ---------- Render ----------
  function updateCamera() {
    const aspect = canvas.width / Math.max(1, canvas.height);
    projection = Mat4.perspective(60 * Math.PI/180, aspect, 0.1, 1000);
    const eye = [
      cameraTarget[0] + Math.sin(cameraPhi) * Math.cos(cameraTheta) * cameraDistance,
      cameraTarget[1] + Math.cos(cameraPhi) * cameraDistance,
      cameraTarget[2] + Math.sin(cameraPhi) * Math.sin(cameraTheta) * cameraDistance,
    ];
    view = Mat4.lookAt(eye, cameraTarget, [0,1,0]);
  }

  let lastTime = performance.now();
  let frameCount = 0;
  let lastFpsUpdate = performance.now();

  function render() {
    resizeCanvasToDisplaySize();
    updateCamera();
    extractFrustumPlanes(projection, view);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniformMatrix4fv(uProjectionLoc, false, projection);
    gl.uniformMatrix4fv(uViewLoc, false, view);

    let visible = instanceCount;
    const scale = 1.0; // base unit sphere radius ~1

    if (cullingToggle.checked) {
      // CPU filter visible instances; draw in batches by reuploading offsets (simple approach)
      const visibleOffsets = [];
      for (let i = 0; i < instanceCount; i++) {
        const cx = instanceOffsets[i*3];
        const cy = instanceOffsets[i*3+1];
        const cz = instanceOffsets[i*3+2];
        const r = instanceRadii[i] * scale;
        if (sphereInFrustum([cx, cy, cz], r)) {
          visibleOffsets.push(cx, cy, cz);
        }
      }
      visible = visibleOffsets.length / 3;

      gl.bindBuffer(gl.ARRAY_BUFFER, iOffsetBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(visibleOffsets), gl.DYNAMIC_DRAW);
      gl.uniform1f(uScaleLoc, 1.0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, sphereVertices.length/3, visible);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, iOffsetBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, instanceOffsets, gl.STATIC_DRAW);
      gl.uniform1f(uScaleLoc, 1.0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, sphereVertices.length/3, instanceCount);
      visible = instanceCount;
    }

    gl.bindVertexArray(null);

    visibleCountEl.textContent = String(visible);

    // FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 500) {
      const fps = frameCount * 1000 / (now - lastFpsUpdate);
      fpsEl.textContent = fps.toFixed(1);
      lastFpsUpdate = now;
      frameCount = 0;
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
