const {test,expect}=require('@playwright/test');
const {navigationButton}=require('./header01-navigation.cjs');
const fs=require('node:fs');
const path=require('node:path');
const evidenceDir=path.resolve(process.env.EVIDENCE_DIR||'../browser-evidence');

const baseURL=process.env.BASE_URL||'http://127.0.0.1:4173';
const CLASS_NAME='3C Dimostrativa';
const SOURCE_TITLE='Le trasformazioni dell’energia';
const SOURCE_TEXT='Una centrale elettrica trasforma energia primaria in energia elettrica.';
const DRAFT_TITLE='Verifica su energia e potenza';
const DRAFT={
  schemaVersion:1,kind:'assessment-draft',title:DRAFT_TITLE,
  description:'Bozza per revisione professionale',
  questions:[{type:'multiple_choice',
    q:'Quale grandezza misura la potenza?',
    options:['Watt','Joule','Volt'],correct:0,
    explanation:'La potenza si misura in watt.'}]
};

test.use({viewport:{width:390,height:844},trace:'retain-on-failure'});
test.setTimeout(150000);

async function openDrawerItem(page,label){
  await navigationButton(page).click();
  const item=page.getByRole('complementary').getByRole('button',{name:label,exact:true});
  await expect(item).toBeVisible();
  await item.click();
}
async function closeSaveNotice(page){
  const heading=page.getByRole('heading',{name:'Dati Salvati in Locale con Successo!'});
  if(await heading.isVisible().catch(()=>false)){
    await page.getByRole('button',{name:'Chiudi',exact:true}).click();
    await expect(heading).toBeHidden();
  }
}
async function expectNoOverflow(page){
  await expect.poll(async()=>page.evaluate(()=>(
    document.documentElement.scrollWidth-document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1);
}

test('INT-02/S3c-02: consenso remoto, anteprima e editor sporco senza autosalvataggio',async({page})=>{
  let calls=0;
  let releaseFirstRequest=null;
  const violations=[];
  page.on('pageerror',error=>violations.push(error.message));
  await page.route('**/api/copilot/assessment-draft/provider',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({available:true,provider:'Servizio simulato',model:'test-only'})
  }));
  await page.route('**/api/copilot/assessment-draft',async route=>{
    const requestNumber=++calls;
    const body=route.request().postDataJSON();
    expect(body.classification).toBe('TEACHER_PROFESSIONAL');
    expect(body.explicitTeacherOptIn).toBe(true);
    expect(body.context.className).toBe(CLASS_NAME);
    expect(body.source.title).toBe(SOURCE_TITLE);
    expect(body.source.text).toContain(SOURCE_TEXT);
    expect(JSON.stringify(body)).not.toMatch(/sourceId|classId|udaId|studentId|grade|provenance|dataBase64/);
    if(requestNumber===1){
      // The first simulated HTTP response is deliberately held pending. The
      // teacher must regain control via explicit cancellation, without retry.
      await new Promise(resolve=>{releaseFirstRequest=resolve;});
    }
    try {
      await route.fulfill({
        status:200,contentType:'application/json',
        body:JSON.stringify({draft:DRAFT,receipt:{
          requestId:'synthetic-s3c02',provider:'fake',model:'test-only',
          attemptCount:1,budget:{tier:'remote-low',profile:'balanced',escalated:false}
        }})
      });
    }catch(error){
      if(requestNumber!==1)throw error; // canceled browser request
    }
  });
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Configura archivio protetto'})).toBeVisible();
  await page.locator('#vault-password').fill('synthetic-s3c02-vault');
  await page.getByRole('button',{name:'Configura archivio protetto'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept(CLASS_NAME));
  await page.getByRole('button',{name:/Nuova Classe/}).click();
  await closeSaveNotice(page);
  await openDrawerItem(page,'Biblioteca privata');
  await page.getByRole('button',{name:'Aggiungi fonte',exact:true}).click();
  await page.getByRole('button',{name:'Testo o idea',exact:true}).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill(SOURCE_TEXT);
  await page.getByRole('button',{name:'Salva in biblioteca',exact:true}).click();
  await expect(page.getByRole('heading',{name:SOURCE_TITLE,exact:true})).toBeVisible();
  await page.getByText('Gestisci',{exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Classifica come materiale professionale'}).click();
  await expect(page.getByText('Professionale',{exact:true}).first()).toBeVisible();

  const trigger=page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole('button',{name:'Parla con il Copilota',exact:true}).click();
  const composer=page.getByTestId('library-copilot-composer');
  await composer.getByTestId('int02-s3c02-create-assessment').click();
  const sourceSelect=composer.getByLabel('Materiale',{exact:true});
  await expect(sourceSelect).toBeVisible();
  await expect(sourceSelect).toBeFocused();
  await composer.getByRole('button',{name:'Altre attività'}).click();
  const assessmentGoal=composer.getByTestId('int02-s3c02-create-assessment');
  await expect(assessmentGoal).toBeFocused();
  await assessmentGoal.click();
  await expect(sourceSelect).toBeFocused();
  await sourceSelect.selectOption({label:SOURCE_TITLE});
  await expect(sourceSelect).toBeFocused();
  // This teacher-first route is already in assessment mode: choosing the
  // source opens the panel directly; there is no redundant second Start.
  await expect(composer.getByTestId('int02-s3c02-start-assessment')).toHaveCount(0);

  const panel=composer.getByTestId('int02-s3c02-assessment-panel');
  await expect(panel).toBeVisible();
  // An assessment is a single focused task, with no competing Continue CTA.
  await expect(composer.getByRole('button',{name:/Continua/})).toHaveCount(0);
  await expect(composer.getByRole('button',{name:'Altre attività'})).toBeVisible();
  await expect(composer).toContainText(CLASS_NAME);
  await expect(composer).toContainText(SOURCE_TITLE);
  await expect(panel).not.toContainText('Classe '+CLASS_NAME);
  await expect(panel.getByRole('button',{name:'Chiudi',exact:true})).toHaveCount(0);
  const providerDetails=panel.getByTestId('int02-assessment-provider-details');
  await expect(providerDetails).not.toHaveAttribute('open','');
  await providerDetails.locator('summary').click();
  await expect(panel.getByText(/Servizio utilizzato: Servizio simulato/)).toBeVisible();
  await providerDetails.locator('summary').click();
  const generate=panel.getByTestId('int02-assessment-generate');
  await expect(generate).toBeDisabled();
  await panel.getByTestId('int02-assessment-objective').fill('Riconoscere le trasformazioni energetiche.');
  await expect(generate).toBeDisabled();
  expect(calls).toBe(0);
  await panel.getByTestId('int02-assessment-remote-consent').check();
  await expect(generate).toBeEnabled();
  // Product review needs the actual request stage, not only a completed proposal.
  fs.mkdirSync(evidenceDir,{recursive:true});
  await expectNoOverflow(page);
  await page.screenshot({path:path.join(evidenceDir,'ux-teacher-01-prepara-390.png'),fullPage:false});
  await page.setViewportSize({width:320,height:700});
  await expectNoOverflow(page);
  await page.screenshot({path:path.join(evidenceDir,'ux-teacher-01-prepara-320.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await generate.click();
  await expect(panel.getByTestId('int02-assessment-cancel')).toBeVisible();
  await expect.poll(()=>calls).toBe(1);
  await panel.getByTestId('int02-assessment-cancel').click();
  await expect(panel.getByTestId('int02-assessment-error')).toContainText('Preparazione annullata');
  await expect(generate).toBeDisabled();
  await expect(panel.getByTestId('int02-assessment-preview')).toHaveCount(0);
  releaseFirstRequest?.();
  await panel.getByTestId('int02-assessment-remote-consent').check();
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(panel.getByTestId('int02-assessment-preview')).toBeVisible();
  await expect(panel).toContainText(DRAFT_TITLE);
  await expect(panel).toContainText('Rivedi domande e risposte prima di salvare la verifica.');
  await expect(panel.getByText('Proposta di verifica',{exact:true})).toBeVisible();
  await expect(panel.getByText('Proposta di verifica',{exact:true})).toBeFocused();
  const questions=panel.getByTestId('int02-assessment-questions-details');
  await expect(questions).not.toHaveAttribute('open','');
  fs.mkdirSync(evidenceDir,{recursive:true});
  await page.screenshot({path:path.join(evidenceDir,'ux-teacher-01-proposta-390.png'),fullPage:true});
  await page.setViewportSize({width:320,height:700});
  await expectNoOverflow(page);
  await page.screenshot({path:path.join(evidenceDir,'ux-teacher-01-proposta-320.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await questions.locator('summary').click();
  await expect(questions.getByText(DRAFT.questions[0].q)).toBeVisible();
  expect(calls).toBe(2);

  // Revising the request returns to the pedagogical objective, with no
  // reused external-consent authority. A third call needs new opt-in.
  await panel.getByRole('button',{name:'Modifica l’obiettivo'}).click();
  await expect(panel.getByTestId('int02-assessment-objective')).toBeFocused();
  await expect(panel.getByTestId('int02-assessment-remote-consent')).not.toBeChecked();
  await expect(generate).toBeDisabled();
  await panel.getByTestId('int02-assessment-remote-consent').check();
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(panel.getByTestId('int02-assessment-preview')).toBeVisible();
  expect(calls).toBe(3);
  // An opt-in is for one remote attempt only; retaining a preview must
  // not silently authorize a third provider request.
  // The request form disappears once the proposal is ready. Its
  // single-use consent was reset and cannot authorize another request.
  await expect(panel.getByTestId('int02-assessment-remote-consent')).toHaveCount(0);
  await expect(generate).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Apri e modifica'})).toBeVisible();
  await expect(panel.getByRole('button',{name:'Modifica l’obiettivo'})).toBeVisible();
  await expectNoOverflow(page);

  await panel.getByTestId('int02-assessment-open-editor').click();
  await expect(page).toHaveURL(/tab=verifiche-online/);
  await expect(composer).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Crea Nuova Verifica Formativa'})).toBeVisible();
  await expect(page.getByTestId('int02-assessment-transfer-notice')).toContainText('Nulla è stato salvato');
  const title=page.getByPlaceholder('es. Verifica Formativa: Energie Rinnovabili e Impatto Ambientale');
  await expect(title).toHaveValue(DRAFT_TITLE);
  await expect(page.getByPlaceholder('Formula chiaramente la domanda...').first()).toHaveValue(DRAFT.questions[0].q);
  await expect(page.getByTestId('int02-s2b-confirm-origin')).toHaveCount(0);
  // The editor is a separate decision: capture and inspect it before any save.
  await expectNoOverflow(page);
  await page.screenshot({path:path.join(evidenceDir,'ux-teacher-01-editor-390.png'),fullPage:false});
  await page.setViewportSize({width:320,height:700});
  await expectNoOverflow(page);
  await page.screenshot({path:path.join(evidenceDir,'ux-teacher-01-editor-320.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByText('Collega a UDA Curricolare').locator('..').locator('select')).toHaveValue('');
  expect(calls).toBe(3);

  await page.getByRole('button',{name:'Condivisione Padlet'}).click();
  const editorExit=page.getByRole('dialog',{name:'Modifiche non salvate'});
  await expect(editorExit).toBeVisible();
  await editorExit.getByRole('button',{name:"Rimani nell'editor"}).click();
  await expect(title).toHaveValue(DRAFT_TITLE);
  await page.goBack();
  const appExit=page.getByRole('dialog',{name:'Modifiche non salvate'});
  await expect(appExit).toBeVisible();
  await appExit.getByRole('button',{name:'Esci senza salvare'}).click();
  await expect(page.getByRole('heading',{name:'Biblioteca privata',exact:true})).toBeVisible();

  await openDrawerItem(page,'Verifiche online');
  await expect(page.getByRole('heading',{name:'Crea Nuova Verifica Formativa'})).toHaveCount(0);
  await expect(page.getByText(DRAFT_TITLE,{exact:true})).toHaveCount(0);
  await expectNoOverflow(page);
  expect(violations).toEqual([]);
});
