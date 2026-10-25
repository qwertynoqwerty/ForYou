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
      uniform vec2 uDiscRotation;
      uniform vec2 uHeartRotation;
      uniform vec2 uFlightRotation;
      uniform float uPulse;
      uniform vec2 uYawRotation;
      uniform vec2 uPitchRotation;
      uniform float uLift;
      uniform float uTint;
      varying vec3 vColor;
      varying float vAlpha;
      vec2 rotatePoint(vec2 p, float a) {
        return vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
      }
      vec2 rotateShared(vec2 p, vec2 rotation) {
        return vec2(p.x * rotation.x - p.y * rotation.y, p.x * rotation.y + p.y * rotation.x);
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
          p.xz = rotateShared(p.xz, uDiscRotation);
          float arrival = smoothstep(.12 + radius * .0003 + seed * .06, .49 + radius * .00035 + seed * .06, uProgress);
          p.xz = rotatePoint(p.xz, (1.0 - arrival) * .65);
          p.y += (1.0 - arrival) * (seed - .5) * 80.0;
          vAlpha = reveal * arrival * (.15 + .56 * aMeta.w) * (1.0 - smoothstep(440.0, 750.0, radius));
          vColor = mix(rose, vec3(1.0, .46, .48), aMeta.w * .88);
        } else if (kind < 1.5) {
          float heart = smoothstep(.46 + seed * .06, .88 + seed * .06, uProgress);
          float pulse = uPulse;
          p.x *= pulse;
          p.xz = rotateShared(p.xz, uHeartRotation);
          p.y += uLift;
          vAlpha = heart * (.58 + aMeta.w * .65);
          vColor = mix(rose, vec3(1.0, .46, .48), .22 + aMeta.w * .65);
        } else if (kind < 2.5) {
          vAlpha = .16 + aMeta.w * .45 + sin(seed * 60.0 + uTime * .35) * .08;
          vColor = mix(vec3(.45, .01, .02), vec3(1.0, .46, .48), aMeta.w);
        } else if (kind < 3.5) {
          p.xz = rotateShared(p.xz, uDiscRotation);
          vAlpha = smoothstep(.04, .58, uProgress) * (.15 + aMeta.w * .3);
          vColor = mix(rose, vec3(1.0, .46, .48), .1 + aMeta.w * .4);
        } else {
          float flight = smoothstep(0.0, 1.0, uProgress * 2.2 - seed * .35);
          p *= 1.0 + flight * 1.8;
          p.z += flight * 500.0;
          p.xz = rotateShared(p.xz, uFlightRotation);
          vAlpha = smoothstep(.0, .14, flight) * (1.0 - smoothstep(.35, .94, flight)) * (.3 + aMeta.w * .4);
          vColor = mix(rose, vec3(1.0, .46, .48), aMeta.w * .8);
        }
        float cy = uYawRotation.x;
        float sy = uYawRotation.y;
        float rx = p.x * cy - p.z * sy;
        float rz = p.x * sy + p.z * cy;
        float pitchCos = uPitchRotation.x;
        float pitchSin = uPitchRotation.y;
        float distance = max(900.0, 2200.0 - rz * pitchCos + p.y * pitchSin);
        float depth = 2200.0 / distance;
        vec2 screen = uCenter + vec2(rx, rz * pitchSin - p.y * pitchCos) * uScale * depth;
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
    this.groups = new Map();
    const rng = SceneMath.random(7421);
    const add = (x, y, z, kind, size, brightness) => {
      const seed = rng();
      if ((kind === 1) === heartOnly) {
        if (!this.groups.has(kind)) this.groups.set(kind, { start: values.length / 7, count: 0 });
        this.groups.get(kind).count++;
        values.push(x, y, z, seed, kind, size, brightness);
      }
    };
    const mobile = SceneMath.isMobileRendering();
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
    this.uniforms = Object.fromEntries(['uViewport', 'uCenter', 'uScale', 'uRatio', 'uTime', 'uProgress', 'uDiscRotation', 'uHeartRotation', 'uFlightRotation', 'uPulse', 'uYawRotation', 'uPitchRotation', 'uLift', 'uTint'].map(name => [name, gl.getUniformLocation(this.program, name)]));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    if (heartOnly) gl.clearColor(0, 0, 0, 0);
    else gl.clearColor(.006, .001, .002, 1);
  }
  resize(width, height, ratio) {
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.ratio = ratio;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(view, time, progress, yaw, tint) {
    const gl = this.gl;
    const u = this.uniforms;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.groups.has(1) && progress <= .46) return;
    gl.useProgram(this.program);
    gl.uniform2f(u.uViewport, view.width, view.height);
    gl.uniform2f(u.uCenter, view.cx, view.cy);
    gl.uniform1f(u.uScale, view.scale);
    gl.uniform1f(u.uRatio, this.ratio);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uProgress, progress);
    gl.uniform2f(u.uDiscRotation, Math.cos(time * .105), Math.sin(time * .105));
    gl.uniform2f(u.uHeartRotation, Math.cos(time * .72), Math.sin(time * .72));
    gl.uniform2f(u.uFlightRotation, Math.cos(time * .05), Math.sin(time * .05));
    gl.uniform1f(u.uPulse, 1 + Math.sin(time * 1.5) * .018);
    gl.uniform2f(u.uYawRotation, Math.cos(yaw), Math.sin(yaw));
    gl.uniform2f(u.uPitchRotation, Math.cos(view.pitch), Math.sin(view.pitch));
    gl.uniform1f(u.uLift, view.heartLift);
    gl.uniform1f(u.uTint, tint);
    const stars = this.groups.get(2);
    const flight = this.groups.get(4);
    if (progress < 0 && stars) gl.drawArrays(gl.POINTS, stars.start, stars.count);
    else gl.drawArrays(gl.POINTS, 0, progress >= .6 && flight ? flight.start : this.count);
  }
}
