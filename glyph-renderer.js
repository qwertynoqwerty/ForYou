class GlyphRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL для подписей недоступен.');
    this.gl = gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, 'attribute vec2 aPosition; attribute vec2 aUV; attribute float aAlpha; uniform vec2 uViewport; uniform float uTop; varying vec2 vUV; varying float vAlpha; void main(){gl_Position=vec4(aPosition.x/uViewport.x*2.0-1.0,1.0-(aPosition.y-uTop)/uViewport.y*2.0,0.0,1.0);vUV=aUV;vAlpha=aAlpha;}');
    const fragment = compile(gl.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D uAtlas; varying vec2 vUV; varying float vAlpha; void main(){vec4 color=texture2D(uAtlas,vUV);gl_FragColor=vec4(color.rgb,color.a*vAlpha);}');
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertex);
    gl.attachShader(this.program, fragment);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    for (const [name, size, offset] of [['aPosition',2,0],['aUV',2,8],['aAlpha',1,16]]) {
      const location = gl.getAttribLocation(this.program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,size,gl.FLOAT,false,20,offset);
    }
    this.viewport = gl.getUniformLocation(this.program, 'uViewport');
    this.topUniform = gl.getUniformLocation(this.program, 'uTop');
    this.top = 0;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(this.program,'uAtlas'),0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0,0,0,0);
    this.atlas = document.createElement('canvas');
    this.atlas.width = 1024;
    this.atlas.height = 512;
    this.painter = this.atlas.getContext('2d');
    this.glyphs = new Map();
    this.x = 1;
    this.y = 1;
    this.row = 0;
    this.dirty = false;
    this.vertices = new Float32Array(65536);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    this.length = 0;
    this.transform = [1,0,0,1,0,0];
    this.context = {
      globalAlpha: 1,
      clearRect: () => { this.length = 0; },
      setTransform: (a,b,c,d,e,f) => {
        const matrix = this.transform;
        matrix[0]=a; matrix[1]=b; matrix[2]=c; matrix[3]=d; matrix[4]=e; matrix[5]=f;
      },
      drawImage: (image,x,y,width,height) => this.drawGlyph(image,x,y,width,height)
    };
  }
  register(image) {
    if (this.glyphs.has(image)) return this.glyphs.get(image);
    if (this.x + image.width + 1 > this.atlas.width) { this.x = 1; this.y += this.row + 2; this.row = 0; }
    if (this.y + image.height + 1 > this.atlas.height) throw new Error('Атлас подписей переполнен.');
    const region = {x:this.x,y:this.y,width:image.width,height:image.height};
    this.painter.drawImage(image,this.x,this.y);
    this.x += image.width + 2;
    this.row = Math.max(this.row,image.height);
    this.glyphs.set(image,region);
    this.dirty = true;
    return region;
  }
  setView(view, ratio) {
    const near = SceneMath.project(0, 14, 600, view);
    const far = SceneMath.project(0, 14, -600, view);
    const top = Math.max(0, Math.floor(Math.min(near.y, far.y) - 32));
    const bottom = Math.min(view.height, Math.ceil(Math.max(near.y, far.y) + 32));
    const height = Math.max(1, bottom - top);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    if (this.canvas.style.top !== top + 'px') this.canvas.style.top = top + 'px';
    if (this.canvas.style.height !== height + 'px') this.canvas.style.height = height + 'px';
    this.top = top * ratio;
  }
  drawGlyph(image,x,y,width,height) {
    if (this.context.globalAlpha < .002) return;
    const region = this.register(image);
    const [a,b,c,d,e,f] = this.transform;
    if (this.length + 30 > this.vertices.length) throw new Error('Буфер подписей переполнен.');
    for (let corner = 0; corner < 6; corner++) {
      const u = corner === 1 || corner >= 4 ? 1 : 0;
      const v = corner === 2 || corner === 3 || corner === 5 ? 1 : 0;
      const px = u ? x + width : x;
      const py = v ? y + height : y;
      this.vertices[this.length++] = a*px+c*py+e;
      this.vertices[this.length++] = b*px+d*py+f;
      this.vertices[this.length++] = (region.x+u*region.width)/this.atlas.width;
      this.vertices[this.length++] = (region.y+v*region.height)/this.atlas.height;
      this.vertices[this.length++] = this.context.globalAlpha;
    }
  }
  flush() {
    const gl = this.gl;
    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    if (this.dirty) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.atlas);
      this.dirty = false;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,this.vertices.subarray(0,this.length));
    gl.uniform2f(this.viewport,this.canvas.width,this.canvas.height);
    gl.uniform1f(this.topUniform,this.top);
    gl.drawArrays(gl.TRIANGLES,0,this.length/5);
  }
}
