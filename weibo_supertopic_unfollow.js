/*
ฅ^•ﻌ•^ฅ

1，用电脑游览器打开微博网页，登录自己的账号，点进[我的关注] [超话]列表页面，确认里面是你关注的超话

2，先往下滚动，让准备取关的超话加载出来。工具只能识别网页已经加载的内容

3，停留在微博页面，同时按 Ctrl＋Shift＋J。会出现一个叫「控制台 / Console」的面板。苹果电脑按 Command＋Option＋J

4，复制此整段脚本代码。

5，回到微博控制台，点击最下面 > 右边的空白位置，粘贴代码，然后按回车。（注意：不是粘贴到浏览器地址栏）

6，网页右上角出现「微博超话批量取关 · 快速版」浮窗，就说明工具打开了。（此时还没有开始取关。）

（！！注意：如果是 .js 文件，右键选择用「记事本」打开，在里面按 Ctrl＋A 全选、Ctrl＋C 复制内容，不要双击运行文件。！！）

如果浏览器不让粘贴

看控制台新出现的黄色提示。它是在提醒你，粘贴代码可能操作你的账号，所以先确认复制的是我发给你的这份脚本。

提示会要求手动输入一个短语：按它显示的内容输入，不加引号，然后回车，再重新粘贴代码。例如提示要求 allow pasting，就输入这两个英文单词；要求「允许粘贴」，就输入这四个字。以你屏幕上的提示为准，不要输入 Plain text 或 JavaScript。

一般输入：允许粘贴   （没错，就是中文口令，如果不行就输入： allow pasting）

7，回车，运行脚本，脚本浮窗会出现。（浮窗关闭后，可以点左上角的叉关闭控制台页面，但注意不要手滑关掉游览器Meow~ ฅ^•ﻌ•^ฅ）

8，浮窗里的功能：


保留名单：	填入不想取关的超话名称，一行一个，尽量与列表名称一致。匹配到的项目会标注「保留」，不能被勾选。可以留空。
扫描当前页:	找出网页已加载、工具能识别的已关注超话，显示在下面。扫描本身不会取关。
超话前的小方框:	打勾表示要取关；不打勾表示本次不处理。
全选:	勾选扫描结果中所有未被保留名单排除的超话。
清空选择:	取消全部勾选，不会改变微博关注状态。
取关所选:	开始取消关注已经勾选的超话。
停止:	停止继续处理。已经发出的当前操作可能仍会完成，已取关的不会自动恢复。
关闭:	任务停止后关闭工具浮窗，不撤销已完成的取关。
底部提示:	显示识别数量、正在处理哪个超话，以及停止或异常原因。

第一次这样操作

点击「扫描当前页」。
填好需要保留的超话名称。
先只勾选一个确实不想要的超话，点击「取关所选」。
确认对应超话已取消关注后，再扫描，勾选其他项目或点击「全选」。
核对名单，点击「取关所选」，等待处理完成

ฅ^•ﻌ•^ฅ
*/
(()=>{
    "use strict";

    const KEY="WBTopicCleaner";
    const isWeibo=(h)=>/(^|\.)weibo\.(com|cn)$/i.test(h);

    if(location.protocol!=="https:" || !isWeibo(location.hostname)){
        throw new Error("请在微博的已关注超话列表运行。");
    }

    if(window[KEY]?.running){
        throw new Error("旧脚本还在运行，请先停止，再运行新版。");
    }

    window[KEY]?.close?.();

    //设置
    const config={keepNames:[],intervalMs:0};
    const state={running:false,stopped:false,rows:[],results:[],page:""};

    const host=document.createElement("aside");
    host.id="wb-topic-cleaner-panel";
    host.style.cssText="position:fixed;right:16px;top:16px;z-index:2147483647";

    const ui=host.attachShadow({mode:"open"});
    const text=(el)=>(el?.innerText || el?.textContent || "").trim();
    const label=(el)=>text(el).replace(/\s/g,"").replace(/^[✓✔√＋+]+/,"");
    const normalizeName=(s)=>s.trim().replace(/^#|#$/g,"").replace(/(?:超话|超話)$/,"").trim();
    const shown=(el)=>el.isConnected && el.getClientRects().length>0 && getComputedStyle(el).visibility!=="hidden" && getComputedStyle(el).display!=="none";

    const FOLLOWED=/^(?:已关注|已關注|取消关注|取消關注)$/;
    const UNFOLLOWED=/^(?:关注|關注|关注超话|關注超話|加关注|加關注)$/;

    const ACTIONS="button,a,[role='button'],[action-type],span,div";
    const DIALOGS="[role='dialog'],[aria-modal='true'],dialog,.woo-dialog-main,.woo-modal-main,.W_layer";
    const POPUPS=DIALOGS+",[role='menu'],[role='listbox'],.woo-pop-main,.woo-pop-wrap,[class*='dropdown'],[class*='Dropdown'],[class*='Popover']";

    //超话ID
    function topicId(a){
        try{
            const u=new URL(a.getAttribute("href"),location.href);

            if(!isWeibo(u.hostname)){
                return null;
            }

            return u.pathname.match(/^\/p\/(100808[a-f\d]{32})(?:\/|$)/i)?.[1].toLowerCase() || null;
        }catch{
            return null;
        }
    }

    function links(root){
        return [...root.querySelectorAll("a[href]")].filter((a)=>shown(a) && topicId(a));
    }

    //识别按钮
    function controls(root,pattern){
        function matches(el){
            if(!shown(el) || el.closest(":disabled,[aria-disabled='true']") || !pattern.test(label(el))){
                return false;
            }

            if([...el.children].some((c)=>shown(c) && pattern.test(label(c)))){
                return false;
            }

            const a=el.closest("a[href]");

            if(!a){
                return true;
            }

            const href=(a.getAttribute("href") || "").trim();
            return !href || href.startsWith("#") || /^javascript:/i.test(href) || a.hasAttribute("action-type") || a.getAttribute("role")==="button";
        }

        return [...root.querySelectorAll(ACTIONS)].filter(matches);
    }

    //识别超话卡片
    function getCard(a){
        const id=topicId(a);

        for(let node=a.parentElement,depth=0;node && depth<7;node=node.parentElement,depth++){
            if(node===document.body || node===document.documentElement || node.matches("main,nav,header")){
                break;
            }

            if(node.closest("article,[role='article'],[node-type='feed_list'],[class*='FeedItem'],[class*='Feed_body']")){
                break;
            }

            if(text(node).length>1200){
                break;
            }

            const ids=new Set(links(node).map(topicId));

            if(ids.size!==1 || !ids.has(id)){
                break;
            }

            function otherLink(anchor){
                try{
                    const href=(anchor.getAttribute("href") || "").trim();

                    if(!href || href.startsWith("#") || /^javascript:/i.test(href) || anchor.hasAttribute("action-type") || anchor.getAttribute("role")==="button" || topicId(anchor)){
                        return false;
                    }

                    return isWeibo(new URL(href,location.href).hostname);
                }catch{
                    return false;
                }
            }

            if([...node.querySelectorAll("a[href]")].some(otherLink)){
                break;
            }

            const buttons=controls(node,/^(?:已关注|已關注|取消关注|取消關注|关注|關注|关注超话|關注超話|加关注|加關注)$/);

            if(buttons.length===1){
                const named=links(node).find((x)=>topicId(x)===id && (text(x) || x.title));
                const name=normalizeName(text(named) || named?.title || a.querySelector("img")?.alt || id);

                return {id,name,card:node,button:buttons[0],followed:FOLLOWED.test(label(buttons[0]))};
            }
        }

        return null;
    }

    function collect(){
        const found=new Map();

        for(const a of links(document)){
            const card=getCard(a);

            if(!card){
                continue;
            }

            const previous=found.get(card.id);

            if(!previous){
                found.set(card.id,card);
            }else if(previous.button!==card.button){
                previous.ambiguous=true;
            }
        }

        return [...found.values()];
    }

    //保留名单
    function keepSet(){
        const names=[...config.keepNames,...ui.querySelector("textarea").value.split(/\r?\n/)];
        return new Set(names.map(normalizeName).filter(Boolean));
    }

    function kept(row){
        const names=keepSet();
        return names.has(row.name) || names.has(row.id);
    }

    function say(message){
        ui.querySelector("[data-status]").textContent=message;
    }

    function visible(selector){
        return [...document.querySelectorAll(selector)].filter(shown);
    }

    //检查停止和异常
    function guard(){
        if(state.stopped){
            throw new Error("已停止；当前已经发出的操作可能仍会完成，请刷新复核。");
        }

        if(location.href!==state.page){
            throw new Error("页面地址已改变，任务停止。");
        }

        const notices=visible(DIALOGS+",[role='alert'],.woo-message-main,.woo-toast-main,.W_layer_tips");
        const errorText=/操作.{0,4}频繁|操作.{0,4}頻繁|稍后再试|稍後再試|安全验证|安全驗證|验证码|驗證碼|请.{0,3}登录|請.{0,3}登入|登录.{0,3}失效|请求失败|取消失败|网络异常|系統繁忙|系统繁忙/;
        const problem=notices.find((el)=>errorText.test(text(el)));
        const captcha=visible("iframe[src*='captcha'],[id*='captcha'],[class*='captcha']");

        if(problem || captcha.length){
            throw new Error("页面出现验证、限流或异常提示，已停止，请查看网页。");
        }
    }

    async function wait(ms){
        const end=Date.now()+ms;

        do{
            guard();
            await new Promise((resolve)=>setTimeout(resolve,Math.min(150,Math.max(0,end-Date.now()))));
        }while(Date.now()<end);

        guard();
    }

    function click(el){
        guard();

        if(!shown(el) || el.closest(":disabled,[aria-disabled='true']")){
            throw new Error("目标按钮已不可用，任务停止。");
        }

        el.click();
    }

    //取关一个超话
    async function unfollow(item){
        guard();

        const current=collect().find((r)=>r.id===item.id);

        if(!current || current.ambiguous){
            throw new Error("无法重新定位「"+item.name+"」，请重新扫描。");
        }

        if(kept(current)){
            return "已跳过：保留名单";
        }

        if(!current.followed){
            return "已跳过：页面已显示未关注";
        }

        if(visible(DIALOGS).length){
            throw new Error("请先关闭微博网页上已有的弹窗。");
        }

        current.button.scrollIntoView({block:"center",behavior:"instant"});
        await wait(300);

        const beforePopups=new Set(visible(POPUPS));
        const beforeCancel=new Set(controls(document,/^(?:取消关注|取消關注)$/));
        const clicked=new Set();

        click(current.button);

        const deadline=Date.now()+12000;
        let stable="";
        let stableAt=0;

        while(Date.now()<deadline){
            await wait(150);

            const dialogs=visible(DIALOGS).filter((d)=>!beforePopups.has(d));
            const dialogButtons=new Set();

            //确认弹窗
            for(const d of dialogs){
                if(!/(?:取消|不再)\s*(?:关注|關注)/.test(text(d))){
                    continue;
                }

                const buttons=controls(d,/^(?:确定|確定|确认|確認|取消关注|取消關注|确定取消|確認取消)$/);

                for(const b of buttons){
                    if(!clicked.has(b)){
                        dialogButtons.add(b);
                    }
                }
            }

            if(dialogButtons.size>1){
                throw new Error("发现多个确认按钮，无法判断，任务停止。");
            }

            if(dialogButtons.size===1){
                const b=[...dialogButtons][0];
                clicked.add(b);
                click(b);
                continue;
            }

            //取关菜单
            function newMenuButton(b){
                const inPopup=visible(POPUPS).some((p)=>!beforePopups.has(p) && p.contains(b));
                return !beforeCancel.has(b) && !clicked.has(b) && !b.closest(DIALOGS) && (current.card.contains(b) || inPopup);
            }

            const menuButtons=controls(document,/^(?:取消关注|取消關注)$/).filter(newMenuButton);

            if(menuButtons.length>1){
                throw new Error("发现多个取关菜单，无法判断，任务停止。");
            }

            if(menuButtons.length===1){
                clicked.add(menuButtons[0]);
                click(menuButtons[0]);
                continue;
            }

            //检查页面结果
            const activePopups=visible(POPUPS).some((p)=>!beforePopups.has(p));
            const same=collect().find((r)=>r.id===item.id);
            let outcome="";

            if(!activePopups && same && !same.ambiguous && UNFOLLOWED.test(label(same.button))){
                outcome="页面显示未关注";
            }else if(!activePopups && !same && !links(document).some((a)=>topicId(a)===item.id)){
                outcome="已从列表移除（请刷新复核）";
            }

            if(outcome!==stable){
                stable=outcome;
                stableAt=Date.now();
            }

            if(stable && Date.now()-stableAt>=1200){
                return stable;
            }
        }

        throw new Error("「"+item.name+"」未得到明确的页面结果，已停止，请刷新复核。");
    }

    //显示列表
    function render(){
        const list=ui.querySelector("[data-list]");
        list.replaceChildren();

        for(const item of state.rows){
            const row=document.createElement("label");
            const box=document.createElement("input");
            const title=document.createElement("span");

            box.type="checkbox";
            box.dataset.id=item.id;
            box.disabled=kept(item);
            box.checked=item.selected && !box.disabled;

            box.addEventListener("change",()=>{item.selected=box.checked;});

            title.textContent=item.name+(box.disabled ? "（保留）" : "");
            title.title=item.id;

            row.append(box,title);
            list.append(row);
        }
    }

    function scan(){
        if(state.running){
            return;
        }

        const previous=new Map(state.rows.map((r)=>[r.id,r.selected]));

        state.rows=collect().filter((r)=>r.followed && !r.ambiguous).map((r)=>({id:r.id,name:r.name,selected:previous.get(r.id) || false}));

        render();

        if(state.rows.length){
            say("识别到 "+state.rows.length+" 个已关注超话，请核对并勾选，数量不限。");
        }else{
            say("未识别到超话按钮。请打开已关注超话列表并加载内容；仍为 0 则需要适配实际页面。");
        }

        return state.rows.map(({id,name})=>({id,name}));
    }

    function setBusy(busy){
        const elements=ui.querySelectorAll("button:not([data-stop]),textarea,input");

        for(const el of elements){
            el.disabled=busy;
        }

        if(!busy){
            render();
        }
    }

    //开始
    async function start(){
        if(state.running){
            return;
        }

        const interval=Number(config.intervalMs);

        if(!Number.isFinite(interval) || interval<0){
            say("设置无效：间隔必须为非负数。");
            return;
        }

        const queue=state.rows.filter((r)=>r.selected && !kept(r));

        if(!queue.length){
            say("请先勾选要取消关注的超话。");
            return;
        }

        state.running=true;
        state.stopped=false;
        state.page=location.href;
        setBusy(true);

        let processed=0;

        try{
            for(const item of queue){
                guard();
                say("处理中 "+(processed+1)+"/"+queue.length+"："+item.name);

                const result=await unfollow(item);

                state.results.push({time:new Date().toISOString(),id:item.id,name:item.name,result});

                item.selected=false;
                processed++;

                console.info("[超话取关]",item.name,result);

                if(processed<queue.length && interval>0){
                    await wait(interval);
                }
            }

            say("本次已处理 "+processed+" 个，请刷新微博复核。新加载的项目需要重新扫描后执行。");
        }catch(error){
            say(error.message+" 本次已处理 "+processed+" 个。");
            console.warn("[超话取关]",error.message);
        }finally{
            state.running=false;
            setBusy(false);
        }
    }

    function stop(){
        state.stopped=true;

        if(state.running){
            say("正在停止；当前已经发出的操作请刷新复核。");
        }
    }

    function close(){
        if(state.running){
            stop();
            return;
        }

        host.remove();

        if(window[KEY]===api){
            delete window[KEY];
        }
    }

    function selectAll(){
        for(const row of state.rows){
            row.selected=!kept(row);
        }

        render();
    }

    function selectNone(){
        for(const row of state.rows){
            row.selected=false;
        }

        render();
    }

    function updateKeep(){
        for(const row of state.rows){
            if(kept(row)){
                row.selected=false;
            }
        }

        render();
    }

    //浮窗样式
    const style=document.createElement("style");

    style.textContent=`
        :host{all:initial;}

        section{
            width:340px;
            max-width:90vw;
            box-sizing:border-box;
            font:14px/1.5 system-ui,sans-serif;
            background:#fff;
            color:#222;
            border:1px solid #ddd;
            border-radius:12px;
            box-shadow:0 8px 35px #0003;
            padding:16px;
        }

        h3{margin:0 0 8px;font-size:17px;}
        p{margin:8px 0;font-size:12px;color:#555;}

        textarea{
            width:100%;
            box-sizing:border-box;
            min-height:54px;
            font:inherit;
            border:1px solid #bbb;
            border-radius:5px;
            padding:6px;
        }

        button{
            font:inherit;
            padding:5px 8px;
            margin:4px 4px 0 0;
            cursor:pointer;
            border:1px solid #ccc;
            border-radius:5px;
            background:#fafafa;
            color:#222;
        }

        button[data-start]{
            background:#bd2637;
            color:white;
            border-color:#bd2637;
        }

        button:disabled{opacity:.5;cursor:default;}
        input{flex-shrink:0;}

        [data-list]{
            max-height:34vh;
            overflow:auto;
            margin:8px 0;
        }

        [data-list] label{
            display:flex;
            gap:8px;
            padding:5px 0;
            align-items:center;
            overflow-wrap:anywhere;
        }

        [data-status]{
            white-space:pre-wrap;
            border-top:1px solid #ddd;
            padding-top:8px;
            max-height:110px;
            overflow:auto;
        }
    `;

    //浮窗内容
    const panel=document.createElement("section");

    const heading=document.createElement("h3");
    heading.textContent="微博超话批量取关 · 快速版";

    const desc=document.createElement("p");
    desc.textContent="仅在自己的已关注超话列表使用。数量不限，确认结果后立即处理下一项。";

    const keepLabel=document.createElement("p");
    keepLabel.textContent="保留名单：超话名称或 ID，一行一个（可留空）";

    const keepInput=document.createElement("textarea");
    keepInput.setAttribute("aria-label","保留名单");

    const toolbar=document.createElement("div");

    const buttons=[
        ["scan","扫描当前页",scan],
        ["all","全选",selectAll],
        ["none","清空选择",selectNone],
        ["start","取关所选",start],
        ["stop","停止",stop],
        ["close","关闭",close]
    ];

    for(const [key,title,action] of buttons){
        const button=document.createElement("button");

        button.type="button";
        button.dataset[key]="";
        button.textContent=title;
        button.addEventListener("click",action);

        toolbar.append(button);
    }

    const list=document.createElement("div");
    list.dataset.list="";

    const status=document.createElement("p");
    status.dataset.status="";
    status.setAttribute("role","status");

    const footer=document.createElement("p");
    footer.textContent="数量不限，无额外间隔；仍需等待页面确认结果。仅处理已加载项目，不自动翻页。运行期间请勿操作微博页面。";

    panel.append(heading,desc,keepLabel,keepInput,toolbar,list,status,footer);
    ui.append(style,panel);
    document.body.append(host);

    keepInput.addEventListener("input",updateKeep);

    const api={
        config,
        scan,
        start,
        stop,
        close,

        get running(){
            return state.running;
        },

        get results(){
            return state.results.map((r)=>({...r}));
        }
    };

    window[KEY]=api;
    scan();

    console.info("快速版已就绪。先扫描并选择，再点击取关所选。停止：WBTopicCleaner.stop()");
})();