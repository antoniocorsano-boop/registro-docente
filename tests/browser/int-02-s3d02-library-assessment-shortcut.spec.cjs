const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const baseURL=process.env.BASE_URL||'http://127.0.0.1:4173';
const evidenceDir=path.resolve(process.env.EVIDENCE_DIR||'../browser-evidence');
const CLASS_NAME='3ª A Fittizia HPR';
const SOURCE_TITLE='Le trasformazioni dell’energia';
const SOURCE_TEXT='Una centrale elettrica trasforma energia primaria in energia elettrica.';
const DRAFT_TITLE='Verifica fittizia sulle trasformazioni';
const DRAFT={schemaVersion:1,kind:'assessment-draft',
  title:DRAFT_TITLE,description:'Bozza di prova da modificare',
  questions:[{type:'multiple_choice',
    q:'Che cosa produce una centrale elettrica?',
    options:['Energia elettrica','Un materiale nuovo','Nessuna trasformazione'],
    correct:0,explanation:'Una centrale converte energia primaria in energia elettrica.'}]
};

test.use({viewport:{width:390,height:844},trace:'retain-on-failure'});
test.setTimeout(120000);

test('S3d Android HPR rework: source action opens governed Copilota, not the manual editor',async({page})=>{
  let calls=0;
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/copilot/assessment-draft/provider',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({available:true,provider:'Servizio simulato',model:'synthetic-only'})
  }));
  await page.route('**/api/copilot/assessment-draft',route=>{
    calls++;
    const body=route.request().postDataJSON();
    expect(body.context.className).toBe(CLASS_NAME);
    expect(body.source.title).toBe(SOURCE_TITLE);
    expect(body.source.text).toBe(SOURCE_TEXT);
    expect(body.classification).toBe('TEACHER_PROFESSIONAL');
    expect(body.explicitTeacherOptIn).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/sourceId|classId|udaId|studentId|grade|dataBase64/);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      draft:DRAFT,receipt:{requestId:'synthetic-android-rework',provider:'fake',
        model:'synthetic-only',attemptCount:1,
        budget:{tier:'remote-low',profile:'balanced',escalated:false}}
    })});
  });

  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.locator('#vault-password').fill('only-synthetic-android-rework');
  await page.getByRole('button',{name:'Configura archivio protetto'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept(CLASS_NAME));
  await page.getByRole('button',{name:/Nuova Classe/}).click();
  const saved=page.getByRole('heading',{name:'Dati Salvati in Locale con Successo!'});
  if(await saved.isVisible().catch(()=>false)){
    await page.getByRole('button',{name:'Chiudi',exact:true}).click();
  }
  await page.getByTestId('header01-brand-navigation').click();
  await page.getByRole('complementary',{name:'Navigazione del Registro'})
    .getByRole('button',{name:'Biblioteca privata',exact:true}).click();
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

  await page.getByRole('button',{name:'Usa',exact:true}).click();
  const useSurface=page.getByTestId('library-source-use-surface');
  await expect(useSurface).toBeVisible();
  const other=useSurface.getByTestId('library-source-other-actions');
  await expect(other).not.toHaveAttribute('open','');
  const primary=useSurface.getByTestId('int02-prepare-assisted-assessment');
  await expect(primary).toBeVisible();
  await expect(primary).toHaveText('Prepara una verifica con il Copilota');
  expect(await primary.boundingBox()).not.toBeNull();
  await primary.click();

  await expect(page.getByTestId('library-source-use-surface')).toHaveCount(0);
  const composer=page.getByTestId('library-copilot-scroll');
  await expect(composer).toBeVisible();
  // A source dialog closes while the Copilota opens. The prior modal must not
  // steal focus back behind the new dialog on the following animation frame.
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect.poll(async () => page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="library-copilot-composer"]'))
  )).toBe(true);
  const panel=composer.getByTestId('int02-s3c02-assessment-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('library-copilot-composer')).toContainText(CLASS_NAME);
  await expect(composer.getByLabel('Materiale',{exact:true})).toHaveValue(/.+/);
  await expect(composer.getByLabel('Materiale',{exact:true})
    .locator('option:checked')).toHaveText(SOURCE_TITLE);
  await expect(page.getByTestId('int02-assessment-handoff')).toHaveCount(0);
  await expect(panel.getByText('Che cosa vuoi verificare?')).toBeVisible();
  await expect(panel.getByTestId('int02-assessment-provider-details')).not.toHaveAttribute('open','');
  await expect(panel.getByTestId('int02-assessment-generate')).toBeDisabled();

  // Cancelling the primary Copilota route must return keyboard focus to the
  // stable «Usa» button, never to an unmounted source action or page body.
  await page.getByTestId('library-copilot-composer')
    .getByRole('button',{name:'Chiudi Copilota',exact:true}).click();
  await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const useButton=page.getByRole('button',{name:'Usa',exact:true});
  await expect(useButton).toBeFocused();
  await useButton.click();
  await page.getByTestId('int02-prepare-assisted-assessment').click();
  await expect(panel).toBeVisible();

  const expectedWidth=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(expectedWidth).toBeLessThanOrEqual(1);
  fs.mkdirSync(evidenceDir,{recursive:true});
  await page.screenshot({path:path.join(evidenceDir,'int02-android-shortcut-390.png')});
  await panel.getByTestId('int02-assessment-objective').fill('Riconoscere le trasformazioni energetiche.');
  await panel.getByTestId('int02-assessment-remote-consent').check();
  await panel.getByTestId('int02-assessment-generate').click();
  await expect(panel.getByTestId('int02-assessment-preview')).toBeVisible();
  expect(calls).toBe(1);
  await panel.getByTestId('int02-assessment-open-editor').click();
  const review=page.getByTestId('int02-assessment-focused-review');
  await expect(review).toBeVisible();
  await expect(page.getByRole('heading',{name:'Rivedi la verifica'})).toBeVisible();
  await expect(page.getByText('Verifiche sulle Lezioni & Flashcards Formative',{exact:true})).toHaveCount(0);
  const title=page.getByPlaceholder('es. Verifica Formativa: Energie Rinnovabili e Impatto Ambientale');
  await expect(title).toHaveValue(DRAFT_TITLE);
  await title.fill('Bozza locale da non salvare');
  await page.goBack();
  const guard=page.getByRole('dialog',{name:'Modifiche non salvate'});
  await expect(guard).toBeVisible();
  await guard.getByRole('button',{name:'Esci senza salvare'}).click();
  await expect(page.getByRole('heading',{name:'Biblioteca privata',exact:true})).toBeVisible();
  expect(calls).toBe(1);
  expect(errors).toEqual([]);
});


test('INT-02: without a generator the teacher continues in a focused unsaved editor',async({page})=>{
  let providerPosts=0;
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('**/api/copilot/assessment-draft/provider',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({available:false,provider:'Non configurato',model:'none'})
  }));
  await page.route('**/api/copilot/assessment-draft',route=>{
    providerPosts++;
    return route.abort();
  });

  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.locator('#vault-password').fill('synthetic-offline-continuity-vault');
  await page.getByRole('button',{name:'Configura archivio protetto'}).click();
  await expect(page.getByRole('heading',{name:'Le mie classi'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept(CLASS_NAME));
  await page.getByRole('button',{name:/Nuova Classe/}).click();
  const notice=page.getByRole('heading',{name:'Dati Salvati in Locale con Successo!'});
  if(await notice.isVisible().catch(()=>false)){
    await page.getByRole('button',{name:'Chiudi',exact:true}).click();
  }
  await page.getByTestId('header01-brand-navigation').click();
  await page.getByRole('complementary',{name:'Navigazione del Registro'})
    .getByRole('button',{name:'Biblioteca privata',exact:true}).click();
  await page.getByRole('button',{name:'Aggiungi fonte',exact:true}).click();
  await page.getByRole('button',{name:'Testo o idea',exact:true}).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill(SOURCE_TEXT);
  await page.getByRole('button',{name:'Salva in biblioteca',exact:true}).click();
  await page.getByText('Gestisci',{exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Classifica come materiale professionale'}).click();
  await expect(page.getByText('Professionale',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Usa',exact:true}).click();
  await page.getByTestId('int02-prepare-assisted-assessment').click();

  const panel=page.getByTestId('int02-s3c02-assessment-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Il generatore non è disponibile.');
  await panel.getByTestId('int02-assessment-objective')
    .fill('Riconoscere le trasformazioni energetiche.');
  await expect(panel.getByTestId('int02-assessment-generate')).toBeDisabled();
  await expect(panel.getByTestId('int02-assessment-remote-consent')).not.toBeChecked();
  const local=panel.getByTestId('int02-assessment-continue-locally');
  await expect(local).toBeEnabled();
  await local.click();

  await expect(panel).toHaveCount(0);
  const editor=page.getByTestId('int02-assessment-focused-review');
  await expect(editor).toBeVisible();
  await expect(page.getByRole('heading',{name:'Prepara la verifica',exact:true})).toBeVisible();
  await expect(editor).toContainText('Scrivi tu le domande');
  await expect(page.getByTestId('int02-assessment-manual-objective'))
    .toContainText('Riconoscere le trasformazioni energetiche.');
  await expect(page.getByPlaceholder('es. Verifica Formativa: Energie Rinnovabili e Impatto Ambientale'))
    .toHaveValue('Verifica: '+SOURCE_TITLE);
  const extra=page.getByTestId('int02-assessment-extra-settings');
  await extra.locator('summary').click();
  await expect(extra.getByRole('textbox')).toHaveValue(
    'Obiettivo didattico: Riconoscere le trasformazioni energetiche.'
  );
  await expect(extra.getByRole('combobox',{name:'UDA'})).toHaveValue('');
  expect(providerPosts).toBe(0);
  const horizontalOverflow=await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  fs.mkdirSync(evidenceDir,{recursive:true});
  await page.screenshot({path:path.join(evidenceDir,'int02-copilot-offline-editor-390.png')});

  await page.goBack();
  const guard=page.getByRole('dialog',{name:'Modifiche non salvate'});
  await expect(guard).toBeVisible();
  await guard.getByRole('button',{name:'Esci senza salvare'}).click();
  await expect(page.getByRole('heading',{name:'Biblioteca privata',exact:true})).toBeVisible();
  expect(providerPosts).toBe(0);
  expect(pageErrors).toEqual([]);
});
