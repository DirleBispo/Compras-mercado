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
$('#photo').addEventListener('change',event=>{
  const file=event.target.files[0];
  if(!file)return;
  const preview=$('#preview');
  preview.src=URL.createObjectURL(file);
  preview.classList.remove('hidden');
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