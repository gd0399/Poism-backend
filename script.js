/* WebGL2 spinning cube with frustum-based perspective */
(function () {
  const canvas = document.getElementById('glcanvas');
  /** @type {WebGL2RenderingContext} */
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) {
    alert('WebGL2 not supported in this browser.');
    return;
  }

  const TAU = Math.PI * 2;
  const ROTATION_SPEED_RAD_PER_SEC = TAU * 0.125; // one full rotation / 8s

  // ---------- Matrix helpers (column-major, OpenGL style) ----------
  const Mat4 = {
    identity() {
      return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
    },

    multiply(a, b) {
      // out = a * b
      const out = new Float32Array(16);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          let sum = 0;
          for (let k = 0; k < 4; k++) {
            sum += a[k * 4 + row] * b[col * 4 + k];
          }
          out[col * 4 + row] = sum;
        }
      }
      return out;
    },

    translation(tx, ty, tz) {
      const m = Mat4.identity();
      m[12] = tx; m[13] = ty; m[14] = tz; // last column
      return m;
    },

    rotationX(rad) {
      const c = Math.cos(rad); const s = Math.sin(rad);
      return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1,
      ]);
    },

    rotationY(rad) {
      const c = Math.cos(rad); const s = Math.sin(rad);
      return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
      ]);
    },
    
    lookAt(eyeX, eyeY, eyeZ, targetX, targetY, targetZ, upX, upY, upZ) {
      // Compute forward, right, and up vectors (right-handed)
      const fx = targetX - eyeX;
      const fy = targetY - eyeY;
      const fz = targetZ - eyeZ;
      const fLen = Math.hypot(fx, fy, fz) || 1;
      const f0 = fx / fLen, f1 = fy / fLen, f2 = fz / fLen;

      // up normalized
      const upLen = Math.hypot(upX, upY, upZ) || 1;
      const up0 = upX / upLen, up1 = upY / upLen, up2 = upZ / upLen;

      // s = normalize(cross(f, up))
      const s0 = f1 * up2 - f2 * up1;
      const s1 = f2 * up0 - f0 * up2;
      const s2 = f0 * up1 - f1 * up0;
      const sLen = Math.hypot(s0, s1, s2) || 1;
      const sx = s0 / sLen, sy = s1 / sLen, sz = s2 / sLen;

      // u = cross(s, f)
      const ux = sy * f2 - sz * f1;
      const uy = sz * f0 - sx * f2;
      const uz = sx * f1 - sy * f0;

      // View matrix (column-major)
      return new Float32Array([
        sx,  ux, -f0, 0,
        sy,  uy, -f1, 0,
        sz,  uz, -f2, 0,
        -(sx * eyeX + sy * eyeY + sz * eyeZ),
        -(ux * eyeX + uy * eyeY + uz * eyeZ),
        f0 * eyeX + f1 * eyeY + f2 * eyeZ,
        1,
      ]);
    },

    // Frustum matrix following OpenGL clip space (right-handed)
    frustum(left, right, bottom, top, near, far) {
      const rl = right - left;
      const tb = top - bottom;
      const fn = far - near;
      const n2 = 2 * near;

      return new Float32Array([
        n2 / rl, 0, 0, 0,
        0, n2 / tb, 0, 0,
        (right + left) / rl, (top + bottom) / tb, -(far + near) / fn, -1,
        0, 0, (-2 * far * near) / fn, 0,
      ]);
    },

    // From vertical FOV in degrees
    perspectiveFromFov(fovYDeg, aspect, near, far) {
      const fovYRad = (fovYDeg * Math.PI) / 180;
      const t = Math.tan(fovYRad / 2) * near;
      const b = -t;
      const r = t * aspect;
      const l = -r;
      return Mat4.frustum(l, r, b, t, near, far);
    },
  };

  // ---------- Shaders ----------
  const vertexSource = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 a_position;',
    'uniform mat4 u_model;',
    'uniform mat4 u_view;',
    'uniform mat4 u_proj;',
    'void main() {',
    '  gl_Position = u_proj * u_view * u_model * vec4(a_position, 1.0);',
    '}',
  ].join('\n');

  // Grayscale depth-based shading: near -> dark, far -> light
  const fragmentSource = [
    '#version 300 es',
    'precision mediump float;',
    'out vec4 outColor;',
    'void main() {',
    '  float d = clamp(gl_FragCoord.z, 0.0, 1.0);',
    '  float gray = mix(0.08, 0.96, pow(d, 1.2));',
    '  outColor = vec4(vec3(gray), 1.0);',
    '}',
  ].join('\n');

  function createShader(glCtx, type, source) {
    const shader = glCtx.createShader(type);
    glCtx.shaderSource(shader, source);
    glCtx.compileShader(shader);
    if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
      const log = glCtx.getShaderInfoLog(shader);
      glCtx.deleteShader(shader);
      throw new Error(`Shader compile error: ${log}`);
    }
    return shader;
  }

  function createProgram(glCtx, vsrc, fsrc) {
    const v = createShader(glCtx, glCtx.VERTEX_SHADER, vsrc);
    const f = createShader(glCtx, glCtx.FRAGMENT_SHADER, fsrc);
    const prog = glCtx.createProgram();
    glCtx.attachShader(prog, v);
    glCtx.attachShader(prog, f);
    glCtx.linkProgram(prog);
    if (!glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
      const log = glCtx.getProgramInfoLog(prog);
      glCtx.deleteProgram(prog);
      throw new Error(`Program link error: ${log}`);
    }
    return prog;
  }

  const program = createProgram(gl, vertexSource, fragmentSource);
  gl.useProgram(program);

  const attribPositionLoc = 0; // layout location=0
  const uniformModelLoc = gl.getUniformLocation(program, 'u_model');
  const uniformViewLoc = gl.getUniformLocation(program, 'u_view');
  const uniformProjLoc = gl.getUniformLocation(program, 'u_proj');

  // ---------- Geometry: cube ----------
  // 8 vertices, indexed triangles
  const positions = new Float32Array([
    -1, -1, -1,
     1, -1, -1,
     1,  1, -1,
    -1,  1, -1,
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
    -1,  1,  1,
  ]);

  const indices = new Uint16Array([
    // front (-Z)
    0, 1, 2, 0, 2, 3,
    // back (+Z)
    4, 6, 5, 4, 7, 6,
    // left (-X)
    4, 0, 3, 4, 3, 7,
    // right (+X)
    1, 5, 6, 1, 6, 2,
    // top (+Y)
    3, 2, 6, 3, 6, 7,
    // bottom (-Y)
    4, 5, 1, 4, 1, 0,
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Position buffer
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(attribPositionLoc);
  gl.vertexAttribPointer(attribPositionLoc, 3, gl.FLOAT, false, 0, 0);

  // Index buffer
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  // ---------- State ----------
  // Light blue background (#66CCFF)
  gl.clearColor(0.4, 0.8, 1.0, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  // ---------- Resize handling ----------
  function resizeCanvasToDisplaySize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const displayWidth = Math.floor(canvas.clientWidth * dpr);
    const displayHeight = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function getProjectionMatrix() {
    const aspect = canvas.width / canvas.height;
    const fovDeg = 90; // fixed ~90 deg FOV
    const near = 0.1;
    const far = 100.0;
    return Mat4.perspectiveFromFov(fovDeg, aspect, near, far);
  }

  // ---------- Render loop ----------
  let previousTs = 0;
  let angle = 0;

  function render(ts) {
    ts *= 0.001; // ms -> s
    const dt = previousTs ? ts - previousTs : 0;
    previousTs = ts;

    // rotate clockwise around Y and X
    angle -= ROTATION_SPEED_RAD_PER_SEC * dt; // clockwise

    resizeCanvasToDisplaySize();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    const model = Mat4.multiply(Mat4.rotationY(angle), Mat4.rotationX(angle * 0.5));
    // Camera slightly above and to the right, looking at origin
    const view = Mat4.lookAt(3, 2, 6, 0, 0, 0, 0, 1, 0);
    const proj = getProjectionMatrix();

    gl.uniformMatrix4fv(uniformModelLoc, false, model);
    gl.uniformMatrix4fv(uniformViewLoc, false, view);
    gl.uniformMatrix4fv(uniformProjLoc, false, proj);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
  }

  // Kick off
  requestAnimationFrame(render);
})();
