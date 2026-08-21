const $=s=>document.querySelector(s);
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
let items=JSON.parse(localStorage.getItem('compras-itens')||'[]');
let deferredPrompt;
const market=$('#market');
market.value=localStorage.getItem('compras-mercado')||'';
market.addEventListener('input',()=>localStorage.setItem('compras-mercado',market.value));

function parsePrice(value){
  const clean=value.replace(/[^0-9,.-]/g,'').replace(/\.(?=.*[.,])/g,'').replace(',','.');
  return Number(clean);
}
function save(){localStorage.setItem('compras-itens',JSON.stringify(items));render()}
function render(){
  const box=$('#items'), empty=$('#empty');
  box.innerHTML='';
  empty.classList.toggle('hidden',items.length>0);
  items.forEach((item,index)=>{
    const el=document.createElement('article');
    el.className='item';
    el.innerHTML=`<div><h3></h3><p></p></div><div><strong></strong><button type="button" aria-label="Excluir produto">Excluir</button></div>`;
    el.querySelector('h3').textContent=item.product;
    el.querySelector('p').textContent=`${item.quantity} × ${money.format(item.price)}`;
    el.querySelector('strong').textContent=money.format(item.price*item.quantity);
    el.querySelector('button').onclick=()=>{items.splice(index,1);save()};
    box.appendChild(el);
  });
  const total=items.reduce((sum,item)=>sum+item.price*item.quantity,0);
  $('#total').textContent=money.format(total);
  $('#itemCount').textContent=`${items.length} ${items.length===1?'item':'itens'}`;
  $('#finishBtn').disabled=$('#clearBtn').disabled=!items.length;
}

function normalizeLine(value){
  return value.replace(/\s+/g,' ').replace(/^[^A-ZÀ-Ú0-9]+|[^A-ZÀ-Ú0-9%]+$/gi,'').trim();
}
function findProduct(text){
  const blocked=/^(R\$|TOTAL|PREÇO|PRECO|OFERTA|PROMOÇÃO|PROMOCAO|A PARTIR|UNIDADE|VALIDADE|CÓDIGO|CODIGO|ECONOMIZE|POR KG|KG)$/i;
  const candidates=text.split(/\r?\n/).map(normalizeLine).filter(line=>{
    const letters=(line.match(/[A-ZÀ-Ú]/gi)||[]).length;
    return letters>=3&&line.length>=4&&line.length<=70&&!blocked.test(line)&&!/^\s*(?:R\$\s*)?\d+[,.]\d{2}\s*$/.test(line);
  });
  candidates.sort((a,b)=>{
    const score=line=>(line.match(/[A-ZÀ-Ú]/gi)||[]).length-(line.match(/\d/g)||[]).length*0.25;
    return score(b)-score(a);
  });
  return candidates[0]||'';
}
function findPrice(text,words=[]){
  const candidates=[];
  for(const word of words){
    const match=String(word.text||'').match(/(\d{1,5})[,.](\d{2})/);
    if(!match)continue;
    const value=Number(`${match[1]}.${match[2]}`);
    if(!Number.isFinite(value)||value<=0||value>99999)continue;
    const box=word.bbox||{};
    const area=Math.max(1,(box.x1-box.x0||1)*(box.y1-box.y0||1));
    candidates.push({value,score:area*Math.max(20,word.confidence||20)});
  }
  if(candidates.length){
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0].value;
  }
  for(const match of text.matchAll(/(?:R\$\s*)?(\d{1,5})[,.](\d{2})/g)){
    const value=Number(`${match[1]}.${match[2]}`);
    if(Number.isFinite(value)&&value>0&&value<=99999)candidates.push({value,score:0});
  }
  return candidates[0]?.value||null;
}
async function prepareImage(file){
  const bitmap=await createImageBitmap(file);
  const max=1800;
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);
  canvas.height=Math.round(bitmap.height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<image.data.length;i+=4){
    const gray=image.data[i]*.299+image.data[i+1]*.587+image.data[i+2]*.114;
    const value=gray>145?Math.min(255,gray*1.12):Math.max(0,gray*.78);
    image.data[i]=image.data[i+1]=image.data[i+2]=value;
  }
  ctx.putImageData(image,0,0);
  bitmap.close();
  return canvas;
}
async function recognizeLabel(file){
  const status=$('#ocrStatus');
  status.textContent='Preparando a foto…';
  $('#formError').textContent='';
  try{
    if(!window.Tesseract)throw new Error('OCR indisponível');
    const image=await prepareImage(file);
    const result=await Tesseract.recognize(image,'por',{
      logger:message=>{
        if(message.status==='recognizing text'){
          status.textContent=`Lendo a etiqueta… ${Math.round((message.progress||0)*100)}%`;
        }
      }
    });
    const text=result.data.text||'';
    const product=findProduct(text);
    const price=findPrice(text,result.data.words||[]);
    if(product)$('#product').value=product;
    if(price)$('#price').value=price.toFixed(2).replace('.',',');
    if(product&&price){
      status.textContent='Produto e preço reconhecidos. Confira antes de adicionar.';
    }else if(product||price){
      status.textContent='Reconhecimento parcial. Complete o campo que faltou.';
    }else{
      status.textContent='Não consegui ler esta etiqueta. Tente aproximar a câmera e evitar reflexos.';
    }
  }catch(error){
    console.error(error);
    status.textContent='Não foi possível reconhecer agora. Verifique a internet ou digite os dados manualmente.';
  }
}

$('#photo').addEventListener('change',event=>{
  const file=event.target.files[0];
  if(!file)return;
  const preview=$('#preview');
  preview.src=URL.createObjectURL(file);
  preview.classList.remove('hidden');
  recognizeLabel(file);
});
$('#addBtn').addEventListener('click',()=>{
  const product=$('#product').value.trim();
  const price=parsePrice($('#price').value);
  const quantity=Number($('#quantity').value);
  if(!product||!Number.isFinite(price)||price<=0||!Number.isInteger(quantity)||quantity<1){
    $('#formError').textContent='Preencha produto, preço e quantidade corretamente.';
    return;
  }
  items.push({product,price,quantity,createdAt:new Date().toISOString()});
  save();
  $('#product').value=$('#price').value='';
  $('#quantity').value=1;
  $('#preview').classList.add('hidden');
  $('#photo').value='';
  $('#ocrStatus').textContent='';
  $('#formError').textContent='';
  $('#product').focus();
});
$('#clearBtn').addEventListener('click',()=>{
  if(confirm('Deseja apagar todos os itens desta compra?')){items=[];save()}
});
$('#finishBtn').addEventListener('click',()=>{
  const history=JSON.parse(localStorage.getItem('compras-historico')||'[]');
  history.push({market:market.value.trim()||'Não informado',items,total:items.reduce((s,i)=>s+i.price*i.quantity,0),finishedAt:new Date().toISOString()});
  localStorage.setItem('compras-historico',JSON.stringify(history));
  $('#finishDialog').showModal();
});
$('#closeDialog').onclick=()=>$('#finishDialog').close();
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferredPrompt=event;$('#installBtn').classList.remove('hidden');
});
$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
render();