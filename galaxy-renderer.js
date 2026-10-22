class GalaxyRenderer {
  constructor(canvas, heartOnly = false) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: heartOnly, antialias: false, powerPreference: 'high-performance' });
    if (!this.gl) throw new Error('WebGL недоступен в этом браузере.');
    const gl = this.gl;
    const vertex = `
      precision highp float;
      attribute vec3 aPosition;
      attribute vec4 aMeta;
      uniform vec2 uViewport;
      uniform vec2 uCenter;
      uniform float uScale;
      uniform float uRatio;
      uniform float uTime;
      uniform float uProgress;
      uniform float uYaw;
      uniform float uPitch;
      uniform float uLift;
      uniform float uTint;
      varying vec3 vColor;
      varying float vAlpha;
      vec2 rotatePoint(vec2 p, float a) {
        return vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
      }
      void main() {
        float seed = aMeta.x;
        float kind = aMeta.y;
        float reveal = smoothstep(0.0, 0.16, uProgress);
        vec3 p = aPosition;
        vec3 rose = vec3(1.0, .09, .16);
        vColor = mix(rose, vec3(1.0, .46, .48), aMeta.w);
        vAlpha = .6;
        if (kind < .5) {
          float radius = length(p.xz);
          p.xz = rotatePoint(p.xz, uTime * .07);
          float arrival = smoothstep(.12 + radius * .0003 + seed * .06, .49 + radius * .00035 + seed * .06, uProgress);
          p.xz = rotatePoint(p.xz, (1.0 - arrival) * .65);
          p.y += (1.0 - arrival) * (seed - .5) * 80.0;
          vAlpha = reveal * arrival * (.15 + .56 * aMeta.w) * (1.0 - smoothstep(440.0, 750.0, radius));
          vColor = mix(rose, vec3(1.0, .46, .48), aMeta.w * .88);
        } else if (kind < 1.5) {
          float heart = smoothstep(.46 + seed * .06, .88 + seed * .06, uProgress);
          float pulse = 1.0 + sin(uTime * 1.5) * .018;
          p.x *= pulse;
          p.xz = rotatePoint(p.xz, uTime * .48);
          p.y += uLift;
          vAlpha = heart * (.58 + aMeta.w * .65);
          vColor = mix(rose, vec3(1.0, .46, .48), .22 + aMeta.w * .65);
        } else if (kind < 2.5) {
          vAlpha = .16 + aMeta.w * .45 + sin(seed * 60.0 + uTime * .35) * .08;
          vColor = mix(vec3(.45, .01, .02), vec3(1.0, .46, .48), aMeta.w);
        } else if (kind < 3.5) {
          p.xz = rotatePoint(p.xz, uTime * .07);
          vAlpha = smoothstep(.04, .58, uProgress) * (.15 + aMeta.w * .3);
          vColor = mix(rose, vec3(1.0, .46, .48), .1 + aMeta.w * .4);
        } else {
          float flight = smoothstep(0.0, 1.0, uProgress * 2.2 - seed * .35);
          p *= 1.0 + flight * 1.8;
          p.z += flight * 500.0;
          p.xz = rotatePoint(p.xz, uTime * .05);
          vAlpha = smoothstep(.0, .14, flight) * (1.0 - smoothstep(.35, .94, flight)) * (.3 + aMeta.w * .4);
          vColor = mix(rose, vec3(1.0, .46, .48), aMeta.w * .8);
        }
        float cy = cos(uYaw);
        float sy = sin(uYaw);
        float rx = p.x * cy - p.z * sy;
        float rz = p.x * sy + p.z * cy;
        float pitch = uPitch;
        float distance = max(900.0, 2200.0 - rz * cos(pitch) + p.y * sin(pitch));
        float depth = 2200.0 / distance;
        vec2 screen = uCenter + vec2(rx, rz * sin(pitch) - p.y * cos(pitch)) * uScale * depth;
        gl_Position = vec4(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0, 0.0, 1.0);
        gl_PointSize = clamp(aMeta.z * max(uScale, .9) * depth * uRatio, 1.2, 32.0);
        if (uProgress < 0.0 && (kind < 1.5 || kind > 2.5)) vAlpha = 0.0;
      }
    `;
    const fragment = `
      precision mediump float;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 delta = gl_PointCoord - .5;
        float radius = dot(delta, delta);
        float alpha = vAlpha * (exp(-radius * 25.0) + exp(-radius * 9.0) * .045);
        if (alpha < .008) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(error);
      }
      return shader;
    };
    const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
    this.program = gl.createProgram();
    shaders.forEach(shader => gl.attachShader(this.program, shader));
    gl.linkProgram(this.program);
    shaders.forEach(shader => gl.deleteShader(shader));
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    const values = [];
    const rng = SceneMath.random(7421);
    const add = (x, y, z, kind, size, brightness) => {
      const seed = rng();
      if ((kind === 1) === heartOnly) values.push(x, y, z, seed, kind, size, brightness);
    };
    const mobile = innerWidth < 600;
    const discCount = mobile ? 18000 : 54000;
    for (let i = 0; i < discCount; i++) {
      const radius = 18 + Math.pow(rng(), .72) * 730;
      const arm = i % 3 * Math.PI * 2 / 3;
      const angle = i % 5 > 2 ? arm + Math.log(1 + radius / 32) * 2.35 + (rng() - .5) * (1.1 + radius / 450) : rng() * Math.PI * 2;
      const thickness = (rng() - .5) * (7 + 22 * Math.exp(-radius / 130));
      add(Math.cos(angle) * radius, thickness, Math.sin(angle) * radius, 0, 1.3 + rng() * 2.8, rng());
    }
    for (let i = 0; i < (mobile ? 3600 : 6500); i++) {
      const angle = rng() * Math.PI * 2;
      const cross = rng() * Math.PI * 2;
      const tube = .5 + rng() * 1.5;
      const fill = i % 5 ? 1 : .35 + rng() * .58;
      const x = (16 * Math.pow(Math.sin(angle), 3) * fill + Math.cos(cross) * tube) * 7.2;
      const y = (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) * 7.2 * fill;
      add(x, y + Math.sin(cross) * tube * 5, Math.sin(cross) * tube * 8, 1, 1.8 + rng() * 2.5, rng());
    }
    for (let i = 0; i < 3600; i++) add((rng() - .5) * 4400, (rng() - .5) * 2300, (rng() - .5) * 1600, 2, 1.1 + rng() * 2.4, rng());
    for (let i = 0; i < 1800; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.pow(rng(), .85) * 58;
      add(Math.cos(angle) * radius, (rng() - .5) * (4 + 8 * Math.exp(-radius / 55)), Math.sin(angle) * radius, 3, 1.15 + rng() * 1.8, rng());
    }
    for (let i = 0; i < 640; i++) {
      const angle = rng() * Math.PI * 2;
      const elevation = (rng() - .5) * Math.PI;
      const radius = 150 + rng() * 850;
      add(Math.cos(angle) * Math.cos(elevation) * radius, Math.sin(elevation) * radius, Math.sin(angle) * Math.cos(elevation) * radius, 4, 3 + rng() * 7, rng());
    }
    this.count = values.length / 7;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.program, 'aPosition');
    const meta = gl.getAttribLocation(this.program, 'aMeta');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(meta);
    gl.vertexAttribPointer(meta, 4, gl.FLOAT, false, 28, 12);
    this.uniforms = Object.fromEntries(['uViewport', 'uCenter', 'uScale', 'uRatio', 'uTime', 'uProgress', 'uYaw', 'uPitch', 'uLift', 'uTint'].map(name => [name, gl.getUniformLocation(this.program, name)]));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    if (heartOnly) gl.clearColor(0, 0, 0, 0);
    else gl.clearColor(.006, .001, .002, 1);
  }
  resize(width, height, ratio) {
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ratio = ratio;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(view, time, progress, yaw, tint) {
    const gl = this.gl;
    const u = this.uniforms;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(u.uViewport, view.width, view.height);
    gl.uniform2f(u.uCenter, view.cx, view.cy);
    gl.uniform1f(u.uScale, view.scale);
    gl.uniform1f(u.uRatio, this.ratio);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uProgress, progress);
    gl.uniform1f(u.uYaw, yaw);
    gl.uniform1f(u.uPitch, view.pitch);
    gl.uniform1f(u.uLift, view.heartLift);
    gl.uniform1f(u.uTint, tint);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }
}
