/* A small WebGL light transport study: the same letter apertures illuminate
   the wall, suspend light in the air, and project onto the floor. */
window.createLightRenderer = function (host) {
  const canvas = document.createElement('canvas');
  canvas.id = 'light-space'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 center;
uniform float focal;
uniform float intensity;
uniform float lightOffset;
uniform vec2 drift;
uniform vec3 lightColor;
uniform sampler2D letters;
uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float plaster(vec2 p){return noise(p*3.)*.5+noise(p*11.)*.25+noise(p*43.)*.125+noise(p*180.)*.065;}
vec3 lamp(){return vec3(lightOffset-.45,7.1,-4.8);}
vec2 wallUV(vec2 p){return vec2((p.x+1.59)/3.18,(4.73-p.y)/3.42);}
float aperture(vec2 p,float blur){vec2 uv=wallUV(p);if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)return 0.;return texture2D(letters,uv,blur).a;}
float transmission(vec3 p,float blur){vec3 l=lamp();if(p.z<=0.)return 0.;float t=-l.z/(p.z-l.z);vec2 q=mix(l.xy,p.xy,t);if(abs(q.x)>2.08||q.y<0.||q.y>5.3)return 0.;return aperture(q,blur);}
void main(){
 vec2 screen=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
 vec3 ro=vec3(-drift.x,2.65-drift.y,10.);
 vec3 rd=normalize(vec3((screen.x-center.x)/focal,(center.y-screen.y)/focal,-1.));
 float dist=30.;float material=0.;
 // Nearest solid surface: standing wall, floor, or the distant room.
 if(rd.y<-.001){float t=-ro.y/rd.y;if(t>0.&&t<dist){dist=t;material=1.;}}
 float tw=-ro.z/rd.z;vec3 wp=ro+rd*tw;
 if(tw>0.&&tw<dist&&abs(wp.x)<2.08&&wp.y>=0.&&wp.y<5.3){dist=tw;material=2.;}
 float tb=(-4.-ro.z)/rd.z;if(tb>0.&&tb<dist){dist=tb;material=3.;}
 vec3 p=ro+rd*dist;
 vec3 col=vec3(.017,.017,.016);
 float grit=plaster(material==1.?p.xz:p.xy);
 if(material==2.){
   float facing=pow(max(0.,1.-abs(p.x)/2.1),2.);
   col=vec3(.105,.093,.078)*( .72+grit*.43+facing*.08);
   float edge=smoothstep(0.,.025,2.08-abs(p.x));col*=.58+.42*edge;
   float a=aperture(p.xy,0.);
   // Illuminated letter edges bleed softly into rough plaster.
   float glow=aperture(p.xy,4.5);
   col+=lightColor*(a*1.65+glow*.32)*intensity;
 }else if(material==1.){
   col=vec3(.053,.052,.047)*(.67+grit*.48);
   vec2 tile=p.xz*vec2(.67,.9);vec2 seams=abs(fract(tile)-.5);
   float joint=max(smoothstep(.489,.5,seams.x),smoothstep(.486,.5,seams.y));
   float tileShade=hash(floor(tile));col*=.85+tileShade*.21;col*=1.-joint*.35;
   // Soft contact shadow from the wall, growing toward its base.
   float shadow=(1.-smoothstep(0.,.55,p.z))*step(0.,p.z)*step(abs(p.x),2.15);col*=1.-shadow*.65;
   float a=transmission(p,1.35);
   float halo=transmission(p,4.2);
   float falloff=clamp(1.4-length(p-lamp())*.047,.55,1.);
   col+=lightColor*(a*1.95+halo*.30)*intensity*falloff;
 }else if(material==3.){
   col=vec3(.046,.044,.038)*(.68+grit*.30);
   float recess=smoothstep(2.9,3.,abs(p.x))*(1.-smoothstep(3.9,4.,abs(p.x)));col*=1.-recess*.63;
 }
 // Single scattering through the exact letter masks. Each step looks back
 // toward the lamp, so shafts cannot originate away from the written glyphs.
 float segment=dist/160.;
 float jitter=.5;
 vec3 scattered=vec3(0.);float extinction=1.;
 for(int i=0;i<160;i++){
   float t=(float(i)+jitter)*segment;vec3 q=ro+rd*t;
   float transmitted=transmission(q,2.3);
   float haze=.063*(.83+.17*noise(q.xy*.9+q.z*.5+time*.008));
   vec3 incoming=normalize(q-lamp());
   float angle=dot(incoming,-rd);
   float g=.40;
   float phase=(1.-g*g)/pow(1.+g*g-2.*g*angle,1.5);
   float energy=transmitted*haze*segment*phase*intensity*8.5;
   scattered+=lightColor*energy*extinction;
   extinction*=exp(-haze*segment*.17);
 }
 col=col*extinction+scattered;
 // Sparse airborne dust, visible only where there is light.
 vec2 dp=screen*.39;float speck=smoothstep(.9998,1.,hash(floor(dp)));
 col+=lightColor*speck*min(.04,length(scattered)*.1);
 vec2 vignette=(screen/resolution-vec2(.54,.43))*vec2(1.,.85);
 col*=1.-smoothstep(.25,.82,length(vignette))*.67;
 // Film response retains a white core with a much softer luminous halo.
 col=vec3(1.)-exp(-col*1.1);
 col=pow(col,vec3(.88));
 col+=(hash(screen)-.5)*.007;
 gl_FragColor=vec4(col,1.);
}`;
  function shader(type, source) { const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s; }
  let program;
  try { program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)); } catch(e) { console.warn('Light renderer: falling back to canvas',e);return null; }
  host.before(canvas);host.style.opacity='0';
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const uniforms=Object.fromEntries(['resolution','center','focal','intensity','lightOffset','drift','lightColor','letters','time'].map(n=>[n,gl.getUniformLocation(program,n)]));
  gl.uniform1i(uniforms.letters,0);
  return {
    updateText(text){ gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,text);gl.generateMipmap(gl.TEXTURE_2D); },
    render({w,h,f,cx,cy,strength,lightX,color,drift,time}){
      const scale=Math.min(devicePixelRatio||1,1.25,1500/w);
      const width=Math.round(w*scale),height=Math.round(h*scale);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      gl.uniform2f(uniforms.resolution,width,height);gl.uniform2f(uniforms.center,cx*scale,cy*scale);gl.uniform1f(uniforms.focal,f*scale);
      gl.uniform1f(uniforms.intensity,strength);gl.uniform1f(uniforms.lightOffset,lightX);gl.uniform2f(uniforms.drift,drift.x,drift.y);
      gl.uniform3f(uniforms.lightColor,...(color==='warm'?[1.,.97,.87]:[.83,.92,1.]));gl.uniform1f(uniforms.time,time/1000);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
  };
};
