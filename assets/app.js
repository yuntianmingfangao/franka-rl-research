(() => {
  'use strict';
  const base=document.body.dataset.base;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const KEY='franka-public-reading-v1', THEME='franka-public-theme-v1';
  let persistent=true, index=[], saved=new Set(), read=new Set(), timer;
  function notify(message) {
    $('#toast').textContent=message; $('#toast').classList.add('show');
    clearTimeout(timer); timer=setTimeout(()=>$('#toast').classList.remove('show'),3300);
  }
  try {
    const raw=JSON.parse(localStorage.getItem(KEY)||'{"saved":[],"read":[]}');
    const valid=a=>Array.isArray(a)&&a.length<=300&&a.every(x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,89}$/.test(x));
    if (!raw||!valid(raw.saved)||!valid(raw.read)||Object.keys(raw).some(k=>!['saved','read'].includes(k))) throw new Error('Invalid reading state');
    saved=new Set(raw.saved); read=new Set(raw.read);
  } catch { persistent=false; }
  function persist() {
    try { localStorage.setItem(KEY,JSON.stringify({saved:[...saved],read:[...read]})); persistent=true; }
    catch { persistent=false; }
    if (!persistent) notify('浏览器存储不可用：状态只在当前页面保留，不跨设备同步。');
  }
  function updateButtons() {
    $$('[data-save]').forEach(b=>{const on=saved.has(b.dataset.save);b.setAttribute('aria-pressed',String(on));b.textContent=on?'已收藏':'收藏';});
    $$('[data-read]').forEach(b=>{const on=read.has(b.dataset.read);b.setAttribute('aria-pressed',String(on));b.textContent=on?'已读 · 撤销':'标为已读';});
  }
  const media=matchMedia('(prefers-color-scheme: dark)');
  let theme='auto';
  try { const v=localStorage.getItem(THEME); if (['auto','light','dark'].includes(v)) theme=v; } catch {}
  function applyTheme() {
    document.documentElement.dataset.theme=theme==='auto'?(media.matches?'dark':'light'):theme;
    const label={auto:'跟随系统',light:'浅色',dark:'深色'}[theme];
    $('#theme-toggle').setAttribute('aria-label',`主题：${label}，点击切换`); $('#theme-toggle').title=`主题：${label}`;
  }
  applyTheme(); media.addEventListener('change',applyTheme);
  $('#theme-toggle').addEventListener('click',()=>{
    theme={auto:'light',light:'dark',dark:'auto'}[theme];
    try { localStorage.setItem(THEME,theme); } catch {}
    applyTheme();
  });
  $('#menu-toggle').addEventListener('click',()=>{
    const on=$('#main-nav').classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded',String(on));
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-save],[data-read]');
    if (!b) return;
    const collection=b.hasAttribute('data-save')?saved:read, id=b.dataset.save||b.dataset.read;
    if (collection.has(id)) collection.delete(id); else collection.add(id);
    persist(); updateButtons(); filter();
  });
  updateButtons();
  const normalize=s=>s.normalize('NFKC').toLocaleLowerCase();
  const matches=(p,q)=>normalize([p.title,p.excerpt,p.text,...p.tags].join(' ')).includes(normalize(q));
  const kinds={method:'论文与方法',learning:'学习笔记',experiment:'实验记录'};
  let selectedTag='', onlySaved=false, onlyUnread=false;
  const library=$('[data-library]');
  function filter() {
    if (!library) return;
    const q=$('#library-search').value.trim(), route=$('#route-filter').value;
    let count=0;
    $$('.library-grid [data-post]').forEach(el=>{
      const p=index.find(p=>p.slug===el.dataset.post)||{title:el.dataset.title,excerpt:el.textContent,text:'',tags:JSON.parse(el.dataset.tags),route:el.dataset.route};
      const show=(!q||matches(p,q))&&(!selectedTag||p.tags.includes(selectedTag))&&(route==='all'||p.route===route)&&(!onlySaved||saved.has(el.dataset.post))&&(!onlyUnread||!read.has(el.dataset.post));
      el.hidden=!show; if(show) count++;
    });
    $('#library-count').textContent=`${count} 篇记录`; $('#library-empty').hidden=count!==0;
    $$('#tag-filter button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tag===selectedTag)));
    $('#saved-filter').setAttribute('aria-pressed',String(onlySaved)); $('#read-filter').setAttribute('aria-pressed',String(onlyUnread));
    const u=new URL(location.href);
    [['q',q],['tag',selectedTag],['route',route==='all'?'':route],['saved',onlySaved?'1':''],['unread',onlyUnread?'1':'']].forEach(([k,v])=>{if(v)u.searchParams.set(k,v);else u.searchParams.delete(k);});
    history.replaceState(null,'',u);
  }
  if (library) {
    const params=new URLSearchParams(location.search);
    $('#library-search').value=(params.get('q')||'').slice(0,200);
    const tag=params.get('tag')||'';
    selectedTag=$$('#tag-filter button').some(b=>b.dataset.tag===tag)?tag:'';
    const route=params.get('route');
    if ([...$('#route-filter').options].some(o=>o.value===route)) $('#route-filter').value=route;
    onlySaved=params.get('saved')==='1'; onlyUnread=params.get('unread')==='1';
    $('#library-search').addEventListener('input',filter); $('#route-filter').addEventListener('change',filter);
    $('#tag-filter').addEventListener('click',e=>{const b=e.target.closest('[data-tag]');if(b){selectedTag=b.dataset.tag;filter();}});
    $('#saved-filter').addEventListener('click',()=>{onlySaved=!onlySaved;filter();});
    $('#read-filter').addEventListener('click',()=>{onlyUnread=!onlyUnread;filter();});
    $('#clear-filters').addEventListener('click',()=>{$('#library-search').value='';$('#route-filter').value='all';selectedTag='';onlySaved=false;onlyUnread=false;filter();});
    filter();
  }
  const dialog=$('#search-dialog');
  function results() {
    const q=$('#global-search').value.trim(); const target=$('#global-results'); target.replaceChildren();
    const list=q?index.filter(p=>matches(p,q)).slice(0,12):index.slice(0,6);
    if (!list.length) {const p=document.createElement('p');p.textContent=index.length?'没有匹配记录。试试方法名称或数据关键词。':'全文索引正在加载，稍后再试。';target.append(p);return;}
    for (const p of list) {
      const a=document.createElement('a'), title=document.createElement('strong'), meta=document.createElement('span');
      a.href=base+'notes/'+p.slug+'/'; title.textContent=p.title; meta.textContent=`${kinds[p.kind]} · ${p.date} · ${p.tags.join(' / ')}`;
      a.append(title,meta);target.append(a);
    }
  }
  function openSearch() {if(!dialog.open)dialog.showModal();results();$('#global-search').focus();}
  $('#open-search').addEventListener('click',openSearch); $('#global-search').addEventListener('input',results);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.isComposing)return;if(e.key==='Escape'&&dialog.open){e.preventDefault();dialog.close();return;}const editing=e.target.closest('input,textarea,[contenteditable=true]');if(!editing&&(e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))){e.preventDefault();openSearch();}});
  fetch(base+'assets/search.json').then(r=>{if(!r.ok)throw new Error('Index unavailable');return r.json();}).then(rows=>{
    if(!Array.isArray(rows)||rows.length>300||rows.some(p=>!p||typeof p.slug!=='string'||!/^[a-z][a-z0-9-]{0,89}$/.test(p.slug)||typeof p.title!=='string'||typeof p.excerpt!=='string'||typeof p.text!=='string'||!Array.isArray(p.tags)||p.tags.some(t=>typeof t!=='string')||!Object.hasOwn(kinds,p.kind)))throw new Error('Invalid index');
    index=rows; const known=new Set(rows.map(p=>p.slug));saved=new Set([...saved].filter(x=>known.has(x)));read=new Set([...read].filter(x=>known.has(x)));updateButtons();filter();if(dialog.open)results();
  }).catch(()=>notify('全文索引暂未加载成功；文章和导航仍可正常阅读。'));
  const featured=$('[data-feature-index]');
  if (featured) {
    let featurePage=0; const cards=$$('[data-feature-index]'), pages=Math.ceil(cards.length/2);
    const show=()=>{cards.forEach((c,i)=>c.hidden=Math.floor(i/2)!==featurePage);$('#feature-page').textContent=`${featurePage+1} / ${pages}`;};
    $('#feature-prev').addEventListener('click',()=>{featurePage=(featurePage-1+pages)%pages;show();});
    $('#feature-next').addEventListener('click',()=>{featurePage=(featurePage+1)%pages;show();});
  }
  if ($('#copy-link')) $('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);notify('文章链接已复制。');}catch{notify('浏览器不允许复制，请使用地址栏中的文章网址。');}});
  if ($('#print-note')) $('#print-note').addEventListener('click',()=>window.print());
  if(document.body.dataset.article) {
    const progress=()=>{const available=document.documentElement.scrollHeight-innerHeight;$('.reading-progress i').style.width=`${available>0?Math.min(100,scrollY/available*100):100}%`;};
    addEventListener('scroll',progress,{passive:true});addEventListener('resize',progress);progress();
  }
})();
