const { test, expect } = require('@playwright/test');
const { navigationButton } = require('./header01-navigation.cjs');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
test.use({viewport:{width:390,height:844},trace:'retain-on-failure'});
test.setTimeout(60000);
const password='synthetic-session-contract';
async function open(page){
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
async function unlock(page){
  await expect(page.getByRole('heading',{name:'Sblocca Registro'})).toBeVisible();
  await expect(page.getByTestId('header01-topbar')).toHaveCount(0);
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button',{name:'Sblocca Registro'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
}
test('SEC-SESSION-01: explicit menu lock and existing lock icon use the same vault',async({page})=>{
  await open(page);
  await menu(page,'Blocca ed esci');
  await unlock(page);
  await page.getByTestId('header01-lock').click();
  await unlock(page);
});
test('SEC-SESSION-01: dirty council draft can remain, save and lock, or be explicitly discarded',async({page})=>{
  await open(page);
  await menu(page,'Consigli di classe');
  const picker=page.getByRole('combobox',{name:'Seleziona classe per il Consiglio'});
  await picker.selectOption({index:1});
  const selected=await picker.inputValue();
  const grade=page.locator('input[aria-label^="Voto di ingresso per"]').first();
  await expect(grade).toBeVisible();
  await grade.fill('8,5');
  await page.getByTestId('header01-lock').click();
  const guard=page.getByRole('dialog',{name:'Modifiche non salvate'});
  await expect(guard).toBeVisible();
  await guard.getByRole('button',{name:'Rimani nei Consigli'}).click();
  await expect(grade).toHaveValue('8,5');
  await menu(page,'Blocca ed esci');
  await expect(guard).toBeVisible();
  await guard.getByRole('button',{name:'Salva e continua'}).click();
  await unlock(page);
  await menu(page,'Consigli di classe');
  await picker.selectOption(selected);
  await expect(grade).toHaveValue('8.5');
  await grade.fill('9');
  await menu(page,'Blocca ed esci');
  await guard.getByRole('button',{name:'Continua senza salvare'}).click();
  await unlock(page);
  await menu(page,'Consigli di classe');
  await picker.selectOption(selected);
  await expect(grade).toHaveValue('8.5');
});
