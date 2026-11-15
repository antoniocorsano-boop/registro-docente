const { test, expect } = require('@playwright/test');
const { navigationButton } = require('./header01-navigation.cjs');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const password = 'synthetic-session-contract';
test.use({viewport:{width:390,height:844},trace:'retain-on-failure'});
test.setTimeout(60000);

async function installNativeDouble(page) {
  await page.addInitScript(() => {
    let epoch=0, foreground=true, authorized=-1;
    window.__sessionEvidence=[];
    window.__transitionSession=(active)=>{
      if (!active && foreground) { epoch++; authorized=-1; }
      foreground=active;
      document.dispatchEvent(new Event('registro-session-change'));
    };
    window.Capacitor={getPlatform:()=> 'android',Plugins:{RegistroSession:{
      getState:async()=>({epoch,foreground}),
      authorize:async(input)=>{
        if(!foreground||input.epoch!==epoch)throw Error('stale native epoch');
        authorized=epoch;
        window.__sessionEvidence.push(['authorize',epoch]);
      },
      acknowledgeShield:async(input)=>{
        if(!foreground||input.epoch!==epoch)throw Error('stale native shield');
        const protectedSurface=Boolean(document.querySelector('[inert][aria-hidden="true"]'))||
          Boolean(document.querySelector('#vault-password'));
        if(authorized!==epoch&&!protectedSurface)throw Error('unsafe reveal');
        window.__sessionEvidence.push(['shield',epoch,protectedSurface]);
      }
    }}};
  });
}
async function open(page){
  await installNativeDouble(page);
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Avvia la prova'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
}
async function menu(page,name){
  await navigationButton(page).first().click();
  await page.getByRole('complementary').getByRole('button',{name,exact:true}).click();
}
async function suspend(page){
  await page.evaluate(()=>window.__transitionSession(false));
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await page.evaluate(()=>window.__transitionSession(true));
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.some(x=>x[0]==='shield'&&x[1]===1&&x[2]))).toBe(true);
}
test('SEC-SESSION-01: resume reauthenticates and preserves an uncommitted draft',async({page})=>{
  await open(page);
  await menu(page,'Consigli di classe');
  const picker=page.getByRole('combobox',{name:'Seleziona classe per il Consiglio'});
  await picker.selectOption({index:1});
  const grade=page.locator('input[aria-label^="Voto di ingresso per"]').first();
  await expect(grade).toBeVisible();
  await grade.fill('8,5');
  await suspend(page);
  await expect(grade).toBeHidden();
  await page.locator('#vault-password').fill('wrong-synthetic-password');
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(grade).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0]);
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(grade).toBeVisible();
  await expect(grade).toHaveValue('8,5');
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0,1]);
  await page.getByTestId('header01-lock').click();
  const guard=page.getByRole('dialog',{name:'Modifiche non salvate'});
  await expect(guard).toBeVisible();
  await guard.getByRole('button',{name:'Continua senza salvare'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
});
test('SEC-SESSION-01: a second pause during unlock cannot authorize stale epoch',async({page})=>{
  await open(page);
  await suspend(page);
  await page.evaluate(()=>{
    const original=window.Capacitor.Plugins.RegistroSession.authorize;
    window.Capacitor.Plugins.RegistroSession.authorize=async input=>{
      if(input.epoch===1){
        window.__transitionSession(false);
        window.__transitionSession(true);
      }
      return original(input);
    };
  });
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.some(x=>x[0]==='shield'&&x[1]===2&&x[2]))).toBe(true);
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0,2]);
});

test('SEC-SESSION-01: delayed successful authorization response cannot reopen a newer generation',async({page})=>{
  await open(page);
  await menu(page,'Consigli di classe');
  await page.getByRole('combobox',{name:'Seleziona classe per il Consiglio'}).selectOption({index:1});
  const grade=page.locator('input[aria-label^="Voto di ingresso per"]').first();
  await grade.fill('8,5');
  await suspend(page);
  await page.evaluate(()=>{
    const original=window.Capacitor.Plugins.RegistroSession.authorize;
    window.Capacitor.Plugins.RegistroSession.authorize=async input=>{
      await original(input); // Native accepted epoch 1, but JS response is held.
      if(input.epoch===1)await new Promise(resolve=>{window.__releaseAuthorization=resolve;});
    };
    window.__exposedWhileStale=false;
    const observe=()=>{
      const top=document.querySelector('[data-testid="header01-topbar"]');
      if(top&&!top.closest('[inert]')&&window.__watchStale)window.__exposedWhileStale=true;
    };
    window.__watchStale=true;
    new MutationObserver(observe).observe(document.getElementById('root'),{subtree:true,attributes:true,childList:true});
  });
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__releaseAuthorization==='function')).toBe(true);
  await page.evaluate(()=>{window.__transitionSession(false);window.__transitionSession(true);});
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.some(x=>x[0]==='shield'&&x[1]===2&&x[2]))).toBe(true);
  await page.evaluate(()=>window.__releaseAuthorization());
  await expect(page.getByText('Sessione Android cambiata. Autenticati nuovamente.')).toBeVisible();
  await expect(grade).toBeHidden();
  expect(await page.evaluate(()=>window.__exposedWhileStale)).toBe(false);
  await page.evaluate(()=>{window.__watchStale=false;});
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(grade).toBeVisible();
  await expect(grade).toHaveValue('8,5');
  await expect.poll(()=>page.evaluate(()=>window.__sessionEvidence.filter(x=>x[0]==='authorize').map(x=>x[1]))).toEqual([0,1,2]);
});
