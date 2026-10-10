/* The gallery uses ray/plane and ray/box intersections, so uploaded pictures,
   handwritten projections, pillars and benches share a perspective and occlude
   one another in three dimensions. No external rendering library is required. */
window.createGalleryRenderer = function (host) {
  const canvas = document.createElement('canvas');
  canvas.id = 'gallery-space'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const vertex = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
  const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 view;
uniform float cameraDistance;
uniform float intensity;
uniform float lightOffset;
uniform float imageAspect;
uniform float imageFit;
uniform vec3 lightColor;
uniform sampler2D words;
uniform sampler2D picture;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
mat3 turn(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
float boxHit(vec3 ro,vec3 rd,vec3 origin,vec3 size,float yaw,out vec3 normal){
 mat3 rot=turn(-yaw);vec3 p=rot*(ro-origin),d=rot*rd;
 vec3 inv=1./d,aa=(-size-p)*inv,bb=(size-p)*inv;
 vec3 lo=min(aa,bb),hi=max(aa,bb);
 float near=max(max(lo.x,lo.y),lo.z),far=min(min(hi.x,hi.y),hi.z);
 if(near>far||far<0.)return 1000.;
 float t=near>0.?near:far;vec3 hit=(p+d*t)/size;vec3 n=vec3(0.);
 if(abs(hit.x)>abs(hit.y)&&abs(hit.x)>abs(hit.z))n.x=sign(hit.x);
 else if(abs(hit.y)>abs(hit.z))n.y=sign(hit.y);else n.z=sign(hit.z);
 normal=turn(yaw)*n;return t;
}
float writing(vec2 uv,float blur){return texture2D(words,fract(uv),blur).a;}
void main(){
 vec2 pixel=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
 float focal=min(resolution.y*1.02,resolution.x*1.65);
 float narrow=1.-smoothstep(.65,.95,resolution.x/resolution.y);
 vec3 ro=vec3(.2+narrow*.5+view.x*.12,2.30+view.y*.10,9.2-cameraDistance);
 vec3 forward=normalize(vec3(mix(-.25,.7,narrow),2.45,-3.)-ro);
 vec3 right=normalize(cross(forward,vec3(0.,1.,0.)));vec3 up=cross(right,forward);
 vec2 xy=(pixel-resolution*vec2(.5,.46))/focal;
 vec3 rd=normalize(forward+right*xy.x-up*xy.y);
 rd=turn(view.x*.15)*rd;rd.y+=view.y*.09;rd=normalize(rd);
 float t=1000.,kind=0.;vec3 n=vec3(0.),tmp;
 // Room: floor, back wall, side walls, and ceiling.
 if(rd.y<-.001){float hit=-ro.y/rd.y;if(hit>0.&&hit<t){t=hit;kind=1.;n=vec3(0.,1.,0.);}}
 if(rd.z<-.001){float hit=(-7.-ro.z)/rd.z;if(hit>0.&&hit<t){t=hit;kind=2.;n=vec3(0.,0.,1.);}}
 if(abs(rd.x)>.001){float side=rd.x>0.?7.:-7.;float hit=(side-ro.x)/rd.x;if(hit>0.&&hit<t){t=hit;kind=3.;n=vec3(-sign(rd.x),0.,0.);}}
 if(rd.y>.001){float hit=(6.8-ro.y)/rd.y;if(hit>0.&&hit<t){t=hit;kind=4.;n=vec3(0.,-1.,0.);}}
 // Central picture pillar and two angled projection walls.
 float b=boxHit(ro,rd,vec3(.7,2.7,-.25),vec3(1.23,2.7,.32),-.18,tmp);
 if(b<t){t=b;kind=5.;n=tmp;}
 b=boxHit(ro,rd,vec3(-4.45,2.15,-2.4),vec3(1.95,2.15,.13),.34,tmp);
 if(b<t){t=b;kind=6.;n=tmp;}
 b=boxHit(ro,rd,vec3(4.55,2.3,-3.2),vec3(2.1,2.3,.13),-.39,tmp);
 if(b<t){t=b;kind=7.;n=tmp;}
 // A distant slim pillar and a foreground pillar create the depth hierarchy.
 b=boxHit(ro,rd,vec3(-1.65,2.8,-5.35),vec3(.22,2.8,.22),0.,tmp);
 if(b<t){t=b;kind=8.;n=tmp;}
 b=boxHit(ro,rd,vec3(-5.3,3.4,3.4),vec3(.23,3.4,.26),0.,tmp);
 if(b<t){t=b;kind=8.;n=tmp;}
 // Low benches: the same ray intersections produce their silhouette.
 b=boxHit(ro,rd,vec3(-2.35,.62,3.4),vec3(.77,.11,.36),-.14,tmp);
 if(b<t){t=b;kind=9.;n=tmp;}
 b=boxHit(ro,rd,vec3(-2.95,.28,3.4),vec3(.07,.28,.24),-.14,tmp);
 if(b<t){t=b;kind=9.;n=tmp;}
 b=boxHit(ro,rd,vec3(-1.75,.28,3.4),vec3(.07,.28,.24),-.14,tmp);
 if(b<t){t=b;kind=9.;n=tmp;}
 b=boxHit(ro,rd,vec3(3.9,.52,-.7),vec3(.62,.09,.28),.10,tmp);
 if(b<t){t=b;kind=9.;n=tmp;}
 b=boxHit(ro,rd,vec3(3.9,.23,-.7),vec3(.40,.23,.05),.10,tmp);
 if(b<t){t=b;kind=9.;n=tmp;}
 vec3 p=ro+rd*t;
 float grit=noise(p.xz*45.+p.y*23.);
 vec3 col=vec3(.014,.013,.012);
 float text=0.,halo=0.;
 if(kind==1.){
   col=vec3(.023,.022,.019)*(.8+grit*.2);
   vec2 tile=p.xz*vec2(.5,.72);vec2 seam=abs(fract(tile)-.5);
   float joints=max(smoothstep(.487,.5,seam.x),smoothstep(.485,.5,seam.y));col*=1.-joints*.45;
   // Text is repeated in world coordinates rather than over the screen.
   vec2 uv=vec2(p.x*.17+p.z*.018+lightOffset*.055,p.z*.16);
   text=writing(uv,0.);halo=writing(uv,2.8);
   float pillarShadow=(1.-smoothstep(.1,1.9,abs(p.x-.7)))*(1.-smoothstep(0.,3.,p.z+.25))*step(-.1,p.z+.25);
   float benchShadow=exp(-length((p.xz-vec2(-2.35,3.4))*vec2(1.1,1.8))*2.);
   float shadow=1.-max(pillarShadow*.80,benchShadow*.70);
   text*=shadow;halo*=shadow;col*=shadow;
   float glancing=.75+.25*clamp(dot(n,normalize(ro-p)),0.,1.);
   col+=lightColor*(text*1.85+halo*.18)*intensity*glancing;
 }else if(kind==2.||kind==3.||kind==6.||kind==7.){
   col=vec3(.022,.021,.017)*(.7+grit*.3);
   vec2 uv;
   if(kind==2.)uv=vec2(p.x*.145,(5.2-p.y)*.19);
   else if(kind==3.)uv=vec2(p.z*.16*sign(p.x),(5.2-p.y)*.20);
   else{
     vec3 local=turn(kind==6.?-.34:.39)*(p-(kind==6.?vec3(-4.45,2.15,-2.4):vec3(4.55,2.3,-3.2)));
     uv=vec2(local.x*.23+.5,(4.5-p.y)*.24);
   }
   uv.x+=lightOffset*.055;
   float panel=step(p.y,5.0)*smoothstep(.05,.28,p.y);
   text=writing(uv,0.)*panel;halo=writing(uv,2.8)*panel;
   float seams=kind==2.?smoothstep(.97,1.,fract((p.x+8.)/4.5))*.4:0.;
   col*=1.-seams;col+=lightColor*(text*1.42+halo*.15)*intensity;
 }else if(kind==5.){
   vec3 local=turn(.18)*(p-vec3(.7,2.7,-.25));
   vec3 normal=turn(.18)*n;
   col=vec3(.029,.027,.022);
   if(normal.z>.5){
     vec2 uv=vec2((local.x+1.23)/2.46,(2.7-local.y)/5.4);
     float panelAspect=2.46/5.4;
     if(imageFit>.5){
       if(imageAspect>panelAspect)uv.x=(uv.x-.5)*panelAspect/imageAspect+.5;
       else uv.y=(uv.y-.5)*imageAspect/panelAspect+.5;
     }else{
       // Contain: the entire photograph is shown; the extra height becomes
       // a quiet dark area carrying a little of the surrounding handwriting.
       if(imageAspect>panelAspect)uv.y=(uv.y-.5)*imageAspect/panelAspect+.5;
       else uv.x=(uv.x-.5)*panelAspect/imageAspect+.5;
     }
     float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
     vec3 art=texture2D(picture,clamp(uv,0.,1.)).rgb;
     float edge=smoothstep(0.,.022,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
     col=mix(col,art*(.70+intensity*.85),inside*edge);
     if(inside<.5){text=writing(vec2(local.x*.26+.5,(5.2-p.y)*.25),1.);col+=lightColor*text*intensity*.36;}
   }else{col+=lightColor*writing(vec2(local.z*.6,(5.2-p.y)*.22),1.)*intensity*.22;}
   float edge=smoothstep(0.,.045,1.23-abs(local.x));col*=.76+.24*edge;
 }else if(kind==4.){
   col=vec3(.004,.004,.004);
   float track=1.-smoothstep(.015,.04,abs(abs(p.x)-3.5));col+=vec3(.007)*track;
   float bulb=exp(-length((p.xz-vec2(3.5,-2.))*vec2(5.,5.))*12.)+exp(-length((p.xz-vec2(-3.5,1.))*vec2(5.,5.))*12.);
   col+=lightColor*bulb*1.2;
 }else if(kind==8.)col=vec3(.005,.005,.004);
 else if(kind==9.)col=vec3(.008,.008,.007)*(.6+max(0.,n.y)*.6);
 // Restrained warm haze: clear projection remains the focus of this room.
 vec3 haze=vec3(0.);
 for(int i=0;i<24;i++){
   vec3 q=ro+rd*((float(i)+.5)/24.*t);
   float cone=exp(-pow(length(q.xz-vec2(.7+lightOffset*.4,-.25))/(1.+(5.7-q.y)*.20),2.)*3.);
   haze+=lightColor*cone*.0014*intensity*min(t,20.)/24.;
 }
 col+=haze;
 col*=1.-smoothstep(12.,26.,t)*.60;
 vec2 vignette=(pixel/resolution-vec2(.5,.48))*vec2(1.,.85);
 col*=1.-smoothstep(.25,.83,length(vignette))*.45;
 col=vec3(1.)-exp(-col*1.05);col=pow(col,vec3(.90));
 col+=(hash(pixel)-.5)*.003;
 gl_FragColor=vec4(col,1.);
}`;
  function shader(type, source) {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program = gl.createProgram();
  try {
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) { console.warn('Gallery renderer unavailable', error); return null; }
  host.before(canvas); gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['resolution','view','cameraDistance','intensity','lightOffset','imageAspect','imageFit','lightColor','words','picture'].map(name => [name, gl.getUniformLocation(program, name)]));
  function texture(unit, mipmap) {
    gl.activeTexture(gl.TEXTURE0 + unit); const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([24,22,18,255]));
    return tex;
  }
  const wordTexture = texture(0, true), pictureTexture = texture(1, false);
  let aspect = 1;
  gl.uniform1i(uniforms.words, 0); gl.uniform1i(uniforms.picture, 1);
  return {
    setVisible(visible) { canvas.hidden = !visible; },
    updateText(source) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, wordTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.generateMipmap(gl.TEXTURE_2D);
    },
    updateImage(source) {
      aspect = source.width / source.height;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pictureTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    },
    render({ w, h, view, zoom, strength, lightX, color, imageFit }) {
      const scale = Math.min(devicePixelRatio || 1, 1.3, 1600 / w);
      const width = Math.round(w * scale), height = Math.round(h * scale);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
      gl.uniform2f(uniforms.resolution, width, height); gl.uniform2f(uniforms.view, view.x, view.y);
      gl.uniform1f(uniforms.cameraDistance, zoom); gl.uniform1f(uniforms.intensity, strength); gl.uniform1f(uniforms.lightOffset, lightX);
      gl.uniform1f(uniforms.imageAspect, aspect); gl.uniform1f(uniforms.imageFit, imageFit === 'cover' ? 1 : 0);
      gl.uniform3f(uniforms.lightColor, ...(color === 'warm' ? [1,.94,.78] : [.83,.92,1]));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
};
