(() => {
  const DB_KEY = "macrofood_price_catalog_v2_pdf";
  let products = loadProducts();
  let stream = null, scanTimer = null, detector = null;
  const $ = id => document.getElementById(id);
  const money = n => Number(n).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
  const normalize = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  function loadProducts(){
    try {
      const saved=localStorage.getItem(DB_KEY);
      if(saved!==null){
        const p=JSON.parse(saved);
        if(!Array.isArray(p))return [];
        const initial=Array.isArray(window.MACROFOOD_INITIAL_PRODUCTS)?window.MACROFOOD_INITIAL_PRODUCTS:[];
        if(initial.length){
          const merged=[...p];
          for(const item of initial){
            const exists=merged.some(x=>(item.code && String(x.code)===String(item.code)) || x.id===item.id || (item.barcode && x.barcode===item.barcode));
            if(!exists)merged.push(item);
          }
          if(merged.length!==p.length){localStorage.setItem(DB_KEY,JSON.stringify(merged));return merged;}
        }
        return p;
      }
      const initial=Array.isArray(window.MACROFOOD_INITIAL_PRODUCTS)?window.MACROFOOD_INITIAL_PRODUCTS:[];
      localStorage.setItem(DB_KEY,JSON.stringify(initial));
      return initial;
    } catch { return Array.isArray(window.MACROFOOD_INITIAL_PRODUCTS)?window.MACROFOOD_INITIAL_PRODUCTS:[]; }
  }
  function save(){ localStorage.setItem(DB_KEY,JSON.stringify(products)); renderProducts(); }
  function toast(msg){ const el=$("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2800); }
  function setMessage(id,msg,error=false){ const el=$(id); el.textContent=msg; el.style.color=error?"#b42318":"#198754"; }
  function parsePrice(v){ if(typeof v==="number") return v; let s=String(v??"").trim().replace(/[R$\s]/g,""); if(!s)return null; if(s.includes(","))s=s.replace(/\./g,"").replace(",","."); const n=Number(s); return Number.isFinite(n)&&n>=0?n:NaN; }
  function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function updateConnection(){const e=$("connection");e.textContent=navigator.onLine?"Online (dados locais)":"Offline";e.className="connection "+(navigator.onLine?"online":"offline");}
  window.addEventListener("online",updateConnection);window.addEventListener("offline",updateConnection);updateConnection();

  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  function showView(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));document.querySelectorAll(".view").forEach(v=>v.hidden=v.id!=="view-"+name);if(name==="products")renderProducts();}
  $("lookupForm").addEventListener("submit",e=>{e.preventDefault();lookup($("lookupInput").value);});
  function lookup(query){
    const q=String(query||"").trim(); if(!q){toast("Digite um código ou nome para consultar.");return;}
    const nq=normalize(q);
    let found=products.find(p=>String(p.barcode||"").trim()===q);
    if(!found)found=products.find(p=>String(p.code)===q);
    if(!found)found=products.find(p=>normalize(p.name)===nq);
    if(!found){const matches=products.filter(p=>normalize(p.name).includes(nq)||normalize(p.brand||"").includes(nq)||String(p.code).includes(q)||String(p.barcode||"").includes(q));if(matches.length===1)found=matches[0];else if(matches.length>1){$("lookupResult").innerHTML=`<div class="panel"><strong>Encontramos ${matches.length} produtos.</strong><p class="muted">Escolha o produto correto:</p>${matches.map(p=>`<button class="small-btn choose-result" data-id="${safe(p.id)}">${safe(p.name)} — ${money(p.retail)}</button>`).join(" ")}</div>`;$("lookupResult").querySelectorAll(".choose-result").forEach(b=>b.onclick=()=>showResult(products.find(p=>p.id===b.dataset.id)));return;}}
    if(!found){$("lookupResult").innerHTML=`<div class="result-card"><strong>Produto não encontrado</strong><p class="muted">O código “${safe(q)}” não está cadastrado neste aparelho. Confira o código ou cadastre o produto na aba Produtos.</p><button class="button primary" id="registerMissing">Cadastrar produto</button></div>`;$("registerMissing").onclick=()=>{showView("products");$("productCode").value=/^\d{1,6}$/.test(q)?q:"";$("barcode").value=/^\d{7,14}$/.test(q)?q:"";$("productName").focus();};return;}
    showResult(found);
  }
  function showResult(p){if(!p)return;$("lookupInput").value=p.barcode||p.code;$("lookupResult").innerHTML=`<article class="result-card"><div class="result-top"><div class="product-symbol">▦</div><div><h2>${safe(p.name)}</h2><div class="meta">Marca: ${safe(p.brand||"Não informada")}<br>Código interno: ${safe(p.code)}<br>Código de barras: ${safe(p.barcode||"Não cadastrado")}</div></div></div><div class="price-grid"><div class="price-box retail"><span>Preço de varejo</span><strong>${money(p.retail)}</strong></div><div class="price-box"><span>Preço de atacado</span><strong>${p.wholesale===null||p.wholesale===""?"Não cadastrado":money(p.wholesale)}</strong></div></div></article>`;}
  $("newProduct").onclick=()=>{resetForm();$("productCode").focus();document.querySelector("#productForm").scrollIntoView({behavior:"smooth",block:"start"});};
  $("cancelEdit").onclick=resetForm;
  function resetForm(){$("productForm").reset();$("editId").value="";$("cancelEdit").hidden=true;setMessage("formMessage","");}
  $("productForm").addEventListener("submit",e=>{
    e.preventDefault();
    const code=$("productCode").value.trim(), barcode=$("barcode").value.trim(), name=$("productName").value.trim(), brand=$("productBrand").value.trim();
    const retail=parsePrice($("retailPrice").value), wholesale=parsePrice($("wholesalePrice").value), id=$("editId").value;
    if(!/^\d{1,6}$/.test(code)){setMessage("formMessage","O código interno deve conter de 1 a 6 dígitos.",true);return;}
    if(!name){setMessage("formMessage","Informe o nome do produto.",true);return;}
    if(Number.isNaN(retail)||retail===null){setMessage("formMessage","Informe um valor de varejo válido.",true);return;}
    if(Number.isNaN(wholesale)){setMessage("formMessage","O valor de atacado não é válido.",true);return;}
    if(barcode && products.some(p=>p.barcode===barcode&&p.id!==id)){setMessage("formMessage","Esse código de barras já está cadastrado.",true);return;}
    if(products.some(p=>String(p.code)===code&&p.id!==id)){setMessage("formMessage","Esse código interno já está cadastrado.",true);return;}
    const p={id:id||makeId(),code,barcode,name,brand,retail,wholesale};
    if(id)products=products.map(x=>x.id===id?p:x);else products.push(p);
    save();resetForm();setMessage("formMessage","Produto salvo com sucesso.");toast("Produto salvo."); 
  });
  function renderProducts(){
    const q=normalize($("productSearch").value||"");
    const list=products.filter(p=>!q||normalize(p.name).includes(q)||normalize(p.brand||"").includes(q)||String(p.code).includes(q)||String(p.barcode||"").includes(q));
    $("productCount").textContent=`${products.length} produto(s) cadastrado(s)`;
    $("productList").innerHTML=list.length?list.map(p=>`<article class="product-row"><div class="product-symbol">▦</div><div class="details"><strong>${safe(p.name)}</strong><div class="meta">Marca: ${safe(p.brand||"Não informada")} · Código ${safe(p.code)} · Barras: ${safe(p.barcode||"—")}</div></div><div class="row-price">${money(p.retail)}${p.wholesale!==null&&p.wholesale!==""?`<div class="meta">Atacado: ${money(p.wholesale)}</div>`:""}</div><div class="row-actions"><button class="small-btn edit" data-id="${safe(p.id)}">Editar</button><button class="small-btn delete" data-id="${safe(p.id)}">Excluir</button></div></article>`).join(""):`<div class="empty-state"><strong>Nenhum produto encontrado</strong><p>Cadastre um produto ou altere a busca.</p></div>`;
    $("productList").querySelectorAll(".edit").forEach(b=>b.onclick=()=>editProduct(b.dataset.id));
    $("productList").querySelectorAll(".delete").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.id));
  }
  $("productSearch").addEventListener("input",renderProducts);
  function editProduct(id){const p=products.find(x=>x.id===id);if(!p)return;showView("products");$("editId").value=p.id;$("productCode").value=p.code;$("barcode").value=p.barcode||"";$("productBrand").value=p.brand||"";$("productName").value=p.name;$("productBrand").value=p.brand||"";$("retailPrice").value=String(p.retail).replace(".",",");$("wholesalePrice").value=p.wholesale===null?"":String(p.wholesale).replace(".",",");$("cancelEdit").hidden=false;document.querySelector("#productForm").scrollIntoView({behavior:"smooth",block:"start"});}
  function deleteProduct(id){const p=products.find(x=>x.id===id);if(!p)return;if(confirm(`Excluir "${p.name}"?`)){products=products.filter(x=>x.id!==id);save();toast("Produto excluído.");}}
  $("exportButton").onclick=()=>{const blob=new Blob([JSON.stringify({app:"MacroFood Consulta de Preços",version:1,exportedAt:new Date().toISOString(),products},null,2)],{type:"application/json"});download(blob,"macrofood-backup-"+new Date().toISOString().slice(0,10)+".json");setMessage("backupMessage","Backup exportado.");};
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function readImport(){const f=$("importFile").files[0];if(!f){setMessage("backupMessage","Selecione um arquivo JSON primeiro.",true);return null;}return f.text().then(t=>{const data=JSON.parse(t),arr=Array.isArray(data)?data:data.products;if(!Array.isArray(arr))throw new Error("O arquivo não contém uma lista de produtos.");return arr.map(normalizeImported);});}
  function normalizeImported(p){const code=String(p.code??p.codigo??"").trim(),name=String(p.name??p.nome??"").trim(),brand=String(p.brand??p.marca??"").trim(),barcode=String(p.barcode??p.codigo_barras??p.ean??"").trim(),retail=parsePrice(p.retail??p.varejo??p.valor_varejo),wholesale=parsePrice(p.wholesale??p.atacado??p.valor_atacado);if(!code||!name||!Number.isFinite(retail))throw new Error("Há produto sem código, nome ou preço de varejo válido.");return{id:p.id||makeId(),code,name,barcode,brand:String(p.brand??p.marca??"").trim(),retail,wholesale:Number.isFinite(wholesale)?wholesale:null};}
  $("mergeImport").onclick=()=>importJson(false);$("replaceImport").onclick=()=>importJson(true);
  async function importJson(replace){try{const incoming=await readImport();if(replace&&!confirm("Isso vai substituir todos os produtos atuais. Continuar?"))return;let next=replace?[]:[...products];for(const p of incoming){const i=next.findIndex(x=>x.code===p.code|| (p.barcode&&x.barcode===p.barcode));if(i>=0)next[i]={...p,id:next[i].id};else next.push(p);}const codes=new Set(),bars=new Set();for(const p of next){if(codes.has(p.code))throw new Error("Há códigos internos duplicados no arquivo.");codes.add(p.code);if(p.barcode){if(bars.has(p.barcode))throw new Error("Há códigos de barras duplicados no arquivo.");bars.add(p.barcode);}}products=next;save();setMessage("backupMessage",`${incoming.length} produto(s) importado(s).`);toast("Importação concluída.");}catch(err){setMessage("backupMessage",err.message||"Não foi possível importar o arquivo.",true);}}
  $("csvImport").onclick=async()=>{const f=$("csvFile").files[0];if(!f){setMessage("backupMessage","Selecione um arquivo CSV primeiro.",true);return;}try{const text=await f.text();const rows=parseCSV(text);if(rows.length<2)throw new Error("CSV vazio ou sem linhas de produtos.");const headers=rows[0].map(x=>normalize(x).replace(/[\s-]+/g,"_"));const pick=(row,keys)=>{const i=headers.findIndex(h=>keys.includes(h));return i<0?"":row[i]||"";};const incoming=rows.slice(1).filter(r=>r.some(x=>x.trim())).map(r=>normalizeImported({code:pick(r,["codigo","código","code"]),name:pick(r,["nome","name","produto"]),brand:pick(r,["marca","brand"]),barcode:pick(r,["codigo_barras","codigodebarras","barcode","ean","gtin"]),brand:pick(r,["marca","brand"]),retail:pick(r,["varejo","valor_varejo","retail","preco_varejo","preco"]),wholesale:pick(r,["atacado","valor_atacado","wholesale","preco_atacado"])}));let count=0;for(const p of incoming){const i=products.findIndex(x=>x.code===p.code||(p.barcode&&x.barcode===p.barcode));if(i>=0)products[i]={...p,id:products[i].id};else products.push(p);count++;}save();setMessage("backupMessage",`${count} produto(s) importado(s) do CSV.`);toast("CSV importado.");}catch(err){setMessage("backupMessage",err.message||"Falha ao importar CSV.",true);}};
  function parseCSV(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=!quoted;}else if(c===","&&!quoted){row.push(cell.trim());cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell.trim());if(row.some(x=>x))rows.push(row);row=[];cell="";}else cell+=c;}row.push(cell.trim());if(row.some(x=>x))rows.push(row);return rows;}
  async function startScan(){
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){
      $("scanStatus").textContent="Para usar a câmera, abra este aplicativo por HTTPS ou em http://localhost. Abrir o arquivo index.html diretamente pode bloquear a câmera.";
      return;
    }
    $("scanButton").disabled=true;
    $("scanStatus").textContent="Preparando leitor de código de barras…";
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      $("video").srcObject=stream;$("video").hidden=false;$("stopScan").hidden=false;$("scanButton").hidden=true;
      await $("video").play();
      if("BarcodeDetector" in window){
        try{
          const formats=await BarcodeDetector.getSupportedFormats();
          const preferred=["ean_13","ean_8","upc_a","upc_e","code_128","itf","code_39"].filter(x=>formats.includes(x));
          if(preferred.length) detector=new BarcodeDetector({formats:preferred});
        }catch{detector=null;}
      }
      if(detector){
        $("scanStatus").textContent="Aponte a câmera para o código de barras e mantenha-o dentro da imagem.";
        scanTimer=setInterval(async()=>{try{if(!$("video").videoWidth)return;const codes=await detector.detect($("video"));if(codes.length&&codes[0].rawValue){const code=codes[0].rawValue;stopScan();$("lookupInput").value=code;lookup(code);}}catch{}},250);
      } else {
        await startZXingFallback();
      }
    }catch(err){
      stopScan();
      $("scanButton").disabled=false;
      $("scanStatus").textContent=err.name==="NotAllowedError"?"A câmera foi bloqueada. Clique no cadeado ao lado do endereço, permita a câmera e tente novamente.":(err.name==="NotFoundError"?"Nenhuma câmera foi encontrada neste dispositivo.":"Não foi possível abrir a câmera. Confira a permissão do navegador e tente novamente.");
    }
  }
  async function startZXingFallback(){
    try{
      if(!window.ZXingBrowser){
        const urls=[
          "https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js",
          "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js"
        ];
        let loaded=false;
        for(const url of urls){
          try{
            await new Promise((resolve,reject)=>{
              const script=document.createElement("script");
              script.src=url;script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error("Falha ao carregar leitor"));};
              document.head.appendChild(script);
            });
            if(window.ZXingBrowser){loaded=true;break;}
          }catch{}
        }
        if(!loaded)throw new Error("Não foi possível baixar o leitor alternativo pelos servidores disponíveis.");
      }
      const Reader=window.ZXingBrowser?.BrowserMultiFormatReader;
      if(!Reader)throw new Error("O leitor alternativo foi baixado, mas não iniciou corretamente.");
      const reader=new Reader();
      window.__macrofoodZXingReader=reader;
      $("scanStatus").textContent="Leitor ativo. Aponte a câmera para o código de barras.";
      reader.decodeFromVideoElementContinuously($("video"),(result)=>{
        if(result?.getText){
          const code=result.getText();
          try{reader.reset();}catch{}
          window.__macrofoodZXingReader=null;
          stopScan();$("lookupInput").value=code;lookup(code);
        }
      });
    }catch(err){
      // Keep the camera preview open instead of abruptly closing it when the CDN is unavailable.
      $("scanStatus").textContent=(err.message||"Não foi possível iniciar a leitura automática.")+" A câmera continua aberta. Tente novamente com internet liberada para unpkg.com/jsdelivr.net ou digite o código no campo de busca. ";
      $("scanButton").hidden=false;$("scanButton").disabled=false;
    }
  }
  function stopScan(){if(scanTimer)clearInterval(scanTimer);scanTimer=null;try{window.__macrofoodZXingReader?.reset();}catch{}window.__macrofoodZXingReader=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$("video").srcObject=null;$("video").hidden=true;$("stopScan").hidden=true;$("scanButton").hidden=false;$("scanButton").disabled=false;}
  $("scanButton").onclick=startScan;$("stopScan").onclick=stopScan;
  renderProducts();
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();