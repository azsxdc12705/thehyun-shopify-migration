// pages: /checkout
(()=> {
  const ID="wf-ecom-shipping-state", V=" ";
  const q='input[name="shipping-method-choice"]';
  const set=(el,val)=>{
    const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
    s ? s.call(el,val) : (el.value=val);
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
  };
  let n=0;
  (function tick(){
    const z=document.getElementById(ID);
    if(z && !z.value.trim()) set(z,V);
    if(document.querySelectorAll(q).length || ++n>80) return;
    setTimeout(tick,50);
  })();
})();