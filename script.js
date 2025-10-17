/* WebGL2 spinning cube with frustum-based perspective */
(() => {
  const canvas = document.getElementById('glcanvas');
  /** @type {WebGL2RenderingContext} */
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) {
    alert('WebGL2 not supported in this browser.');
    return;
  }

  // ---------- UI ----------
  const depthDebugCheckbox = document.getElementById('depthDebug');
  const fovSlider = document.getElementById('fov');
  const fovOut = document.getElementById('fovOut');

  const TAU = Math.PI * 2;
  const ROTATION_SPEED_RAD_PER_SEC = TAU * 0.125; // 1/8 tau per second

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
  const vertexSource = `#version 300 es\nprecision highp float;\nlayout(location=0) in vec3 a_position;\nlayout(location=1) in vec3 a_color;\nuniform mat4 u_model;\nuniform mat4 u_view;\nuniform mat4 u_proj;\nout vec3 v_color;\nvoid main() {\n  gl_Position = u_proj * u_view * u_model * vec4(a_position, 1.0);\n  v_color = a_color;\n}`;

  const fragmentSource = `#version 300 es\nprecision mediump float;\nin vec3 v_color;\nuniform bool u_depthDebug;\nout vec4 outColor;\nvoid main() {\n  if (u_depthDebug) {\n    outColor = vec4(vec3(gl_FragCoord.z), 1.0);\n  } else {\n    outColor = vec4(v_color, 1.0);\n  }\n}`;

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
  const attribColorLoc = 1; // layout location=1
  const uniformModelLoc = gl.getUniformLocation(program, 'u_model');
  const uniformViewLoc = gl.getUniformLocation(program, 'u_view');
  const uniformProjLoc = gl.getUniformLocation(program, 'u_proj');
  const uniformDepthDebugLoc = gl.getUniformLocation(program, 'u_depthDebug');

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

  const colors = new Float32Array([
    0.9, 0.1, 0.1,  // 0
    0.1, 0.9, 0.1,  // 1
    0.1, 0.1, 0.9,  // 2
    0.9, 0.9, 0.1,  // 3
    0.9, 0.1, 0.9,  // 4
    0.1, 0.9, 0.9,  // 5
    0.9, 0.5, 0.1,  // 6
    0.6, 0.6, 0.6,  // 7
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

  // Color buffer
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(attribColorLoc);
  gl.vertexAttribPointer(attribColorLoc, 3, gl.FLOAT, false, 0, 0);

  // Index buffer
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  // ---------- State ----------
  gl.clearColor(0.05, 0.05, 0.07, 1);
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
    const fovDeg = Number(fovSlider.value);
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
    const view = Mat4.translation(0, 0, -6);
    const proj = getProjectionMatrix();

    gl.uniformMatrix4fv(uniformModelLoc, false, model);
    gl.uniformMatrix4fv(uniformViewLoc, false, view);
    gl.uniformMatrix4fv(uniformProjLoc, false, proj);
    gl.uniform1i(uniformDepthDebugLoc, depthDebugCheckbox.checked ? 1 : 0);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
  }

  // ---------- UI wiring ----------
  fovSlider.addEventListener('input', () => {
    fovOut.textContent = String(fovSlider.value);
  });
  fovOut.textContent = String(fovSlider.value);

  // Kick off
  requestAnimationFrame(render);
})();
