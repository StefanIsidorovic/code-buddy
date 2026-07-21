# AIadne Local Progress

Ovaj fajl je ljudski dnevnik napretka i od 2026-07-15 se cuva u git-u zajedno sa aktivnim working knowledge stanjem.

Koristi ga da brzo vidis, ljudski i prosto:
- sta smo uradili
- sta trenutno radi
- sta sledece treba da uradimo
- koje korake pravimo dok radimo

Radno pravilo:

- Fake ACP vise nije korisnicka opcija ni javna Tauri komanda; ostaje samo interni Rust protocol fixture, a frontend testovi koriste Start Selected ACP.
- Frontend decomposition je pocela izdvojenim, direktno testiranim presentation modulom; roadmap dalje vodi kroz feature komponente, uske Zustand store-ove i typed Tauri gateway.
- Shared UI primitive i globalne notifications su izdvojene; Zustand trenutno poseduje samo bounded notification lifecycle, ne lokalne forme ili workflow draft state.
- Svi frontend DTO/domain ugovori su izdvojeni iz App.tsx u dependency-free src/types/domain.ts sa compile-time contract testovima.
- ACP Controls je izdvojen u state-free typed feature komponentu; orchestration i Tauri pozivi ostaju u App dok ne dobiju poseban hook/gateway sloj.
- Session Output i live/saved ACP transcript prikaz su izdvojeni bez premestanja xterm, polling, scroll ili transcript lifecycle ownership-a iz App-a.
- Workspace/repository context summary i picker kontrole su izdvojene uz ocuvanu responsive DOM granicu; selection i modali ostaju u App-u.
- Repository management dialog je izdvojen; App i dalje poseduje controlled draftove, selection i async create/delete/refresh operacije.
- Workspace management dialog je izdvojen; App i dalje poseduje controlled draftove, native folder picker, selection/persistence, async operacije i potvrdu brisanja projekta.
- Pocetni Project Initialize modal je izdvojen; App i dalje poseduje repository scope, kreiranje/persistenciju initialization run-a, greske i sve kasnije faze.
- Interview Guardrails modal je izdvojen; App i dalje poseduje draft validaciju/mutacije, reset, save/persistenciju, loading i greske.
- Initialization Details modal je izdvojen sa Facts, Markdown, Summary i Knowledge Unit prikazima; App i dalje poseduje izabrani view, approval i async loading/error tokove.
- Project Delete potvrda je izdvojena; App i dalje poseduje busy close guard, ACP stop-before-delete, persistence, selection cleanup, greske i toastove.
- Task Context Preview modal je izdvojen; App i dalje poseduje selector invoke, prompt, visibility i loading/error/result lifecycle.
- New Knowledge Card modal je izdvojen; App i dalje poseduje scope, create/persistence, list update, auto-attach, transcript linkage, reset i loading/error lifecycle.
- Knowledge Cards sidebar je izdvojen; App i dalje poseduje refresh, attachment state/persistence, transcript linkage, dialog/error policy i mutacije.
- Session History sidebar je izdvojen; feature radi filter i three-row cap, dok App poseduje open/rename persistence, stale-response guardove, selection, loading i greske.
- ACP Registry sidebar je izdvojen; App i dalje poseduje discovery, selected ID, loading/greske i session selection policy.
- Terminal PTY/Agent Doctor sidebar je izdvojen; App i dalje poseduje Doctor discovery, runtime mode, loading/greske i active-session policy.
- Initialization Summary phase kartica je izdvojena; App i dalje poseduje catalog/selection workflow, provider generation, persistence, loading i greske.
- Kad uvedemo novu tehnologiju, koncept, runtime path, workflow ili arhitekturnu odluku, odmah update-ujemo sve relevantno: Linear taskove, working_knowledge, mind map i ovaj lokalni dnevnik.
- Kad postoji vise nacina da nesto uradimo, pored stabilnog/default pristupa proverimo i noviji pristup ako ima smisla, pa predlozimo onaj koji stvarno daje vrednost bez nepotrebnog rizika.

## Gde smo sada

- Projekat je resetovan na Tauri + Rust + React + TypeScript + Vite osnovu.
- AIA-002 PTY core je napravljen.
- Backend moze da startuje fake PTY sesiju.
- Backend moze da pise input u PTY, cita output, resize-uje, stopira i killuje sesiju.
- Dodali smo minimalni frontend za rucno testiranje PTY-ja.
- Dodali smo privremeni `Start Codex` da proverimo da pravi Codex CLI moze da radi iz nase aplikacije.
- Dodali smo xterm terminal prikaz, jer Codex crta terminalski UI i obican tekst prikaz nije dovoljan.
- Input sada ide direktno kroz xterm u PTY, pa Enter, strelice i terminalske komande rade kako Codex ocekuje.
- Dodali smo active mind map za lakse pracenje sistema.
- AIA-003 adapter boundary je napravljen.
- Imamo `AgentAdapter` interfejs i `AgentRegistry` za `codex`, `claude_code` i `kimi`.
- Postojeci Codex smoke path sada koristi `CodexAdapter` za pravljenje komande.
- AIA-004 doctor/detection je dodat.
- App sada prikazuje Agent Doctor: installed, missing ili error za Codex, Claude Code i Kimi.
- `Start Codex` je blokiran ako doctor kaze da Codex CLI nije spreman.
- Dodali smo ACP spike u plan kao AIA-017.
- ACP je plan za "normalniji" razgovor app-a i agenta preko strukturisanih poruka, dok PTY ostaje fallback za agente koji rade kao terminal.
- AIA-017 prvi slice je implementiran.
- Backend sada moze da startuje fake ACP proces preko stdio.
- Backend salje ACP `initialize`, `session/new` i `session/prompt`.
- Backend prima ACP `session/update` i pretvara ga u strukturisane evente za frontend.
- Front ima `ACP Test` panel i `ACP Events` listu.
- Dodali smo ACP Registry discovery kao AIA-018.
- App sada moze da prikaze ACP kandidate: Codex ACP, Claude ACP, Kimi i Gemini.
- Ovo samo proverava sta je spremno ili instalabilno; ne skida pakete i ne pokrece prave agente.
- ACP Registry kandidati sada mogu da se selektuju preko `Select`.
- `Start Selected ACP` sada pokrece izabranog launchable ACP kandidata.
- Ako je kandidat preko `npx`, prvi start moze da skida paket.
- ACP Test sada jasnije pokazuje sta je aktivno: npr. `fake · running` ili `Codex · running`.
- Ako pise `fake · running`, prvo klikni `Stop ACP`, pa tek onda `Start Selected ACP`.
- Rucni Codex ACP test je pokazao da pravi Codex ACP radi i vraca odgovor, ali kao puno sitnih chunkova.
- Backend sada spaja agent message chunkove u citljivu poruku i krije tehnicke session/status update-e.
- ACP start/send/stop/list komande sada idu kroz background blocking task da app ne deluje kao not responding dok agent radi.
- Odlucili smo da ne dodajemo posebno `Start Codex ACP` dugme.
- `Start Selected ACP` ostaje glavni generic put, jer isti flow treba da radi za Codex, Claude, Kimi, Gemini i buduce agente.
- Dok ACP sesija radi, izbor kandidata se zakljucava da UI ne pokazuje jedno kao selected, a drugo kao aktivno.
- Mozes da pises zadatke u `ACP prompt`; bug koji smo videli je bio u prikazu Codex ACP eventova.
- Codex ACP `agent_thought_chunk` i content-array update-i se sada prikazuju kao citljivi `Plan`/`Agent` eventi, ne kao raw JSON `notice`.
- Codex ACP prompt sada sme da traje duze od kratkih setup komandi.
- Ako ACP proces pukne ili ga stopiramo dok cekamo odgovor, backend treba brzo da se vrati umesto da ceka pun timeout.
- Backend odbija drugi prompt dok prvi jos traje.
- Dok prompt traje, `Send ACP` je disabled, ali `Stop ACP` i `Drain ACP` ostaju dostupni.
- Dodali smo prvi transcript/history sloj za ACP.
- Backend sada cuva transcript session i evente u SQLite.
- Frontend sada pravi transcript kad startujes ACP sesiju i upisuje user prompt + ACP evente.
- UI sada ima `Session History` listu sa source/runtime/event count.
- Ako history upis pukne, app treba da prikaze gresku, ali da ne blokira aktivni ACP runtime.
- `Session History` sada moze da se klikne.
- Klik na history sesiju otvara sacuvane user/agent evente u output panelu.
- `View Live ACP` vraca prikaz na aktivnu/live ACP sesiju.
- History sada sme da ima samo jednu selektovanu sesiju.
- Kad kliknes drugu history sesiju, stari output se odmah cisti i ne mesaju se poruke.
- Levi `Runtime Test` hero je uklonjen; taj prostor sada koristimo za PTY/ACP mode, accordion izbor agenta, `Session History` i runtime status.
- Sidebar sada ima svoj scroll, pa duge liste agenata/history-ja ne smeju da se preklapaju sa status tekstom.
- Saved transcript sada treba da se cita kao chat: `Question` za tvoja pitanja i `Answer` za agentove odgovore.
- Ako agent posalje odgovor u vise chunkova, history prikaz ih spaja u jedan citljiv odgovor.
- ACP output sada auto-scrolluje na najnoviji event dok agent odgovara.
- Background ACP drain sada koristi aktivni transcript id, da chunkovi odgovora ne odu samo u live UI bez upisa u history.
- UI sada ima pastelni polish: mekse panele, lepse dugmice, bolje focus/hover stanje i obojene transcript/event kartice.
- Knowledge Cards sidebar ostaje mesto za pregled i attach postojecih kartica.
- Dodajemo `+` koji otvara popup za novu Knowledge Card, da sidebar ne bude zatrpan inline formom.
- Workspace sada podrzava projekte sa vise repozitorijuma i aktivni repository odredjuje PTY/ACP radni direktorijum.
- Project Initialize sada prolazi kroz Preflight, Facts, Markdown, Interview, Summary i Approval faze.
- OpenAI Responses moze da generise Summary uz strict structured output i tacne evidence source labele.
- Approved Summary se atomicki pretvara u male source-backed Knowledge Units; rucni Knowledge Cards ostaju odvojeni.
- Deterministicki task-context selector bira relevantne Knowledge Units pod budzetom i prikazuje zasto je svaka jedinica ukljucena ili izostavljena.
- Backend sada ima persistentni Task vezan za projekat i jednu ACP transcript sesiju, sa analysis, planning, execution i review fazama koje nastaju atomicki.
- Prvi project-owned ACP prompt kreira Task pre transcript/agent side effect-a, a naredni promptovi u istoj sesiji koriste isti Task.
- Svaki novi Task dobija explainable `quick`, `standard` ili `complex` predlog; initial rezultat ostaje sacuvan, a user override dobija razlog i append-only audit zapis.
- ACP Controls sada prikazuje read-only Active Task karticu sa profilom, fazom, razlozima, confidence/source i classifier verzijom.
- Summary model i Coding model su sada odvojeni izbori: ACP Controls ucitava modele koje aktivni agent stvarno podrzava i menja model samo za tu coding sesiju.
- Coding model izbor ne menja `~/.codex/config.toml`; agent bez model capability-ja ostaje upotrebljiv i UI to jasno prikazuje.
- ACP Controls sada ima premium chevron toggle: sklapa model, Task assessment i result detalje da Output dobije vise prostora, dok Prompt/Send, Drain i Stop ostaju dostupni.
- Chevron je sada velika/deblja samostalna strelica bez stalnog kruga, border-a ili shadow-a; velika nevidljiva klik zona i keyboard focus ostaju.
- Selector je trenutno preview-only: `Send ACP` jos ne ubacuje generisane jedinice bez eksplicitne korisnicke kontrole.
- Vidljivi proizvod, Tauri window i sidebar sada nose AIadne identitet, lokalni logo, Geist font i Ariadne Atelier boje.

## Sta trenutno radi

- `Start Fake` radi kao test PTY runtime-a.
- `Start Codex` treba da pokrene lokalni Codex CLI ako je `codex` dostupan na PATH-u.
- xterm prikazuje ANSI/TUI output citljivo.
- Backend testovi proveravaju PTY lifecycle i adapter registry.
- Backend testovi proveravaju PTY lifecycle, adapter registry i doctor statuse.
- Frontend testovi proveravaju terminal panel, doctor prikaz i slanje xterm inputa u backend.
- Backend testovi proveravaju fake ACP initialize/session/prompt, malformed JSON, empty prompt, missing session i cleanup procesa.
- Frontend testovi proveravaju fake ACP start, prompt send i prikaz ACP eventa.
- Backend testovi proveravaju ACP registry statuse za npx i binary kandidate.
- Frontend prikazuje ACP Registry listu sa statusom, komandom, install hintom i izabranim kandidatom.
- Backend testovi proveravaju pravljenje launch komande za selected ACP kandidata i odbijanje missing/unknown kandidata.
- Frontend testovi proveravaju da `Start Selected ACP` salje izabrani `candidateId` backendu.
- Frontend testovi proveravaju da `Start Selected ACP` moze da pokrene i ne-default launchable kandidata.
- Frontend testovi proveravaju da se kandidat ne moze promeniti dok ACP sesija radi.
- Backend testovi proveravaju da ACP text-array content i thought chunkovi ne cure kao raw JSON.
- Backend testovi proveravaju duzi prompt timeout, duplicate prompt rejection i child exit tokom cekanja.
- Frontend testovi proveravaju da `Stop ACP` ostaje dostupan dok prompt traje.
- Backend testovi proveravaju transcript session/event storage, los input i brisanje projekta bez gubitka history-ja.
- Frontend testovi proveravaju `Session History` i da ACP flow salje transcript upise.
- Frontend testovi proveravaju da klik na sacuvani transcript ucitava i prikazuje stare user/agent evente.
- Frontend testovi proveravaju prebacivanje izmedju dve sacuvane sesije bez mesanja poruka.

## Kako rucno testirati

Pokreni:

```bash
export PATH=/home/katarina/.nvm/versions/node/v22.22.2/bin:$PATH
npm run tauri dev
```

Test fake sesije:

1. Klikni `Start Fake`.
2. Klikni u crni terminal.
3. Ukucaj nesto.
4. Pritisni Enter.
5. Treba da vidis `fake:<tvoj tekst>`.

Test Agent Doctor-a:

1. Prebaci na `Terminal PTY` i otvori `PTY Agents` accordion levo.
2. Pogledaj `Agent Doctor`.
3. Codex treba da bude `Installed` ako `codex --version` radi u istom terminalu.
4. Claude/Kimi mogu biti `Missing` dok ih ne instaliramo.
5. Ako je Codex missing ili error, `Start Codex` treba da bude disabled.

Test Codex sesije:

1. Klikni `Start Codex`.
2. Ako se Codex UI pojavi, klikni u terminal.
3. Kucaj direktno u terminal.
4. Ako ne radi, proveri:

```bash
codex --version
```

Test selected ACP sesije:

1. Izaberi launchable ACP Registry kandidata i klikni `Start Selected ACP`.
2. U `ACP prompt` upisi nesto.
3. Klikni `Send ACP`.
4. U `ACP Events` treba da vidis strukturirani odgovor izabranog agenta.
5. Klikni `Stop ACP` kad zavrsis.

Test ACP Registry-ja:

1. Prebaci na `Structured ACP` i otvori `ACP Agents` accordion levo.
2. Pogledaj `ACP Registry`.
3. Codex ACP, Claude ACP i Gemini su npx kandidati.
4. Ako je `npx` dostupan, treba da pise da su `Installable`.
5. Kimi je binary kandidat; ako nemas `kimi`, treba da pise `Missing binary`.
6. Klikni `Select` na kandidatu da promenis izabrani ACP.
7. Klikni `Start Selected ACP` da probas izabranog launchable kandidata.
8. Dok ACP sesija radi, `Select` dugmad treba da budu disabled.
9. U `ACP prompt` mozes da pises zadatak za agenta.
10. Klikni `Send ACP`.
11. `ACP Events` treba da prikaze citljive `Plan`/`Agent` redove, ne raw JSON `notice`.
12. Dok agent radi, `Send ACP` treba da bude disabled, ali `Stop ACP` i `Drain ACP` treba da ostanu enabled.
13. Ako je kandidat npx-based, prvi start moze da potraje jer skida paket.
14. Posle `Send ACP`, pogledaj `Session History` levo.
15. Treba da vidis novu sesiju, npr. `Codex ACP`, i broj eventa veci od nule.
16. Klikni tu sesiju u `Session History`.
17. Output treba da predje u `Saved Transcript` i prikaze stare user/agent evente.
18. Klikni `View Live ACP` da se vratis na live prikaz.
19. Klikni drugu history sesiju.
20. Treba da ostane selektovana samo ta druga sesija i da se poruke prve ne vide.
21. `Session History` sada treba da bude levo, ne u glavnom panelu.
22. Kada Codex ACP sesija radi, u `Coding model` izaberi neki drugi ponudjeni model.
23. Izbor treba da ostane prikazan za aktivnu sesiju; zatim posalji prompt i proveri da vise nema greske za prethodni globalni `gpt-5.6-sol` izbor.
24. U `Saved Transcript` proveri da agentov odgovor nije iseckan u vise redova, nego da je prikazan kao jedan `Answer`.
25. Dok agent odgovara u live `ACP Events`, output treba sam da skroluje na najnoviji deo.
26. Za proveru history-ja napravi novi prompt posle ovog fix-a; stari transcript-i kojima chunkovi nikad nisu upisani ne mogu skroz da se poprave.
27. Klikni chevron u ACP Controls headeru; model i Task assessment treba da se sklone, dok Prompt/Send i Drain/Stop ostaju vidljivi i Session Output dobija vise prostora.
25. Vizuelno proveri da pastelni UI nema overlap i da kartice ostaju citljive.

## Komande za proveru

```bash
npm run typecheck
npm run test -- --run
npm run build
cd src-tauri && cargo test
cd src-tauri && cargo clippy -- -D warnings
```

Napomena: `npm run build` moze da prijavi warning da je xterm chunk veci od 500 kB. To je trenutno ocekivano.

## Sta je sledece

1. Rucno proci kompletan Tauri smoke test: AIadne prozor, workspace/repository, Project Initialize, pravi Codex ACP, transcript replay i restart aplikacije.
2. Dodati task knowledge koji nastaje kroz analysis, planning, execution i review, sa tacnim phase/source provenance-om i dubinom prema effective complexity profilu.
3. Dodati eksplicitno user-approved context assembly za ACP prompt.
4. Dodati continue-from-transcript kao novu sesiju bez menjanja istorijskog razgovora.
5. Razloziti veliki `App.tsx` pre dodavanja jos nekoliko stateful workflow-a.

Prosto receno: app vec ume da upozna projekat, napravi proverljivo znanje, izabere relevantan context, pokrene agenta i sacuva razgovor. Sledeci veliki korak je da korisnik potvrdi taj context i stvarno ga posalje agentu.

## Trenutna verifikacija

- 2026-07-15: TypeScript typecheck, 33 frontend testa, production build, 80 Rust testova, clippy sa zabranjenim warning-ima i diff check prolaze.
- Poznat non-fatal warning: glavni Vite/xterm JavaScript chunk je veci od 500 kB.

## Dnevnik koraka

### 2026-07-19 — Active Task assessment panel

- Sta smo hteli: da quick/standard/complex procena moze rucno da se vidi i proveri u pravoj aplikaciji.
- Sta smo promenili: ACP Controls sada prikazuje read-only Task assessment za live transcript; panel pokazuje effective profil, fazu, razloge, confidence/source, verziju i initial profil kada je promenjen.
- Kako smo proverili: 38 frontend testova, 88 Rust testova, typecheck, production build, clippy, CSS token check, diff check i dva review ciklusa.
- Sta jos nije pokriveno: UI jos nema user override kontrolu i fazni knowledge artefakti jos nisu implementirani.
- Sledeci korak: rucni Tauri test panela, zatim plan item 18.4 za task knowledge i phase transitions.

### 2026-07-19 — Adaptive Task complexity

- Sta smo hteli: da isti Task lifecycle radi i za malo dugme i za celu novu vertikalu bez nepotrebno teske ili prelake obrade.
- Sta smo promenili: Rust sada deterministicki predlaze quick, standard ili complex uz strukturisane razloge, confidence i verziju; initial/effective vrednosti se cuvaju odvojeno, a svaki user override ostaje u append-only istoriji.
- Kako smo proverili: 88 Rust testova, legacy migration test, fmt, clippy sa zabranjenim warning-ima, diff check i tri adversarial review ciklusa.
- Sta jos nije pokriveno: analysis jos ne potvrdjuje/reklasifikuje profil, a UI jos ne prikazuje predlog niti override kontrolu.
- Sledeci korak: plan item 18.4, fazni task knowledge i analysis-driven complexity confirmation.

### 2026-07-19 — Task iz prvog ACP prompta

- Sta smo hteli: da jedna project-owned ACP sesija prakticno postane jedan Task i da follow-up promptovi ne prave duplikate.
- Sta smo promenili: faze su uredjene kao analysis, planning, execution i review; Task se kreira pre prvog prompt side effect-a, ucitava se po transcript ID-u i ponovo koristi u istoj sesiji.
- Kako smo proverili: 37 frontend testova, 82 Rust testa, typecheck, fmt, clippy sa zabranjenim warning-ima, diff check i dva adversarial review ciklusa.
- Sta jos nije pokriveno: faze jos nemaju tranzicije ni svoje immutable knowledge artefakte, a Task jos nije prikazan u UI-ju.
- Sledeci korak: plan item 18.3, task knowledge i fazne tranzicije sa source provenance-om.

### 2026-07-19 — Task lifecycle foundation

- Sta smo hteli: uvesti Task kao persistentni korisnicki zadatak koji kasnije gradi sopstveno znanje kroz faze.
- Sta smo promenili: dodati su Task i TaskPhase storage modeli, SQLite tabele, create/list komande i atomicko kreiranje analysis, planning, execution i review faza.
- Kako smo proverili: 82 Rust testa, fmt, clippy sa zabranjenim warning-ima, diff check i adversarial review ciklus 1.
- Sta jos nije pokriveno: frontend jos ne kreira Task iz prvog ACP prompta, a fazni knowledge i tranzicije tek slede.
- Sledeci korak: plan item 18.2, povezivanje prvog ACP prompta sa Task-om bez menjanja originalnog transcript eventa.

### 2026-07-15 — Vidljivi Tauri naziv

- Sta smo hteli: da Tauri product i window title prikazuju AIadne umesto Code Buddy.
- Sta smo promenili: samo `productName` i glavni window `title` u `src-tauri/tauri.conf.json`.
- Kako smo proverili: tacne JSON provere, frontend build, Tauri CLI info i diff review.
- Sta jos nije pokriveno: interni npm/Rust nazivi i `com.codebuddy.app` namerno nisu menjani.
- Sledeci korak: otvoriti app i vizuelno potvrditi AIadne naslov prozora.

### 2026-07-14 — Ariadne Atelier color system

- Sta smo hteli: definisati premium color sistem specifican za AIadne bez menjanja tipografije, layouta, spacinga, animacija ili logike.
- Sta smo promenili: uvedeni su semanticki `--color-*` tokeni; cypress vodi akcije/navigation, copper selection/focus/progress/link, parchment povrsine, a laurel/gold/kiln success/warning/error stanja.
- Kako smo proverili: typecheck, 33 frontend testa, production build, contrast proracuni, diff check i desktop/mobile headless renderi kroz dva review ciklusa po plan itemu.
- Sta jos nije pokriveno: full dark mode ne postoji i nije dodat; real Tauri runtime sa popunjenim podacima ostaje za rucni visual smoke test.
- Sledeci korak: pregledati paletu u pravom Tauri prozoru i prijaviti samo konkretne color korekcije ako ih ima.

### 2026-07-14 — AIadne logo

- Sta smo hteli: ubaciti odobreni AIadne logo koncept u samu aplikaciju.
- Sta smo promenili: privremeno slovo `A` u sidebaru zamenjeno je lokalnim SVG znakom sa Ariadninom niti, lavirintom, tri agent cvora i izlaznom strelicom.
- Kako smo proverili: typecheck, 33 frontend testa, production build, diff check i dva review ciklusa.
- Sta jos nije pokriveno: Tauri window/installer ikone jos koriste stari platform icon set.
- Sledeci korak: vizuelno proveriti logo u Tauri runtime-u, pa po zelji izvesti platform icon pack.

Format za svaki novi korak:

```text
YYYY-MM-DD
- Sta smo hteli:
- Sta smo promenili:
- Kako smo proverili:
- Sta jos nije pokriveno:
- Sledeci korak:
```

### 2026-07-08

- Sta smo hteli: nastaviti posle PTY core-a i pripremiti sistem za vise agenata.
- Sta smo promenili: dodali smo adapter boundary i registry.
- Kako smo proverili: `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`.
- Sta jos nije pokriveno: pravi Claude/Kimi adapteri i pun Codex adapter jos nisu implementirani.
- Sledeci korak: AIA-004 doctor/detection.

### 2026-07-08

- Sta smo hteli: da aplikacija vidi koji agent CLI-jevi su instalirani i spremni.
- Sta smo promenili: dodali smo Agent Doctor backend komandu i UI listu za Codex, Claude Code i Kimi.
- Kako smo proverili: `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`.
- Sta jos nije pokriveno: finalni first-run UI i pravi adapteri za Claude/Kimi/Codex.
- Sledeci korak: prvi puni real-agent adapter.

### 2026-07-08

- Sta smo hteli: ubaciti ACP u plan ako nam pomaze da app i agent pricaju strukturisano.
- Sta smo promenili: dodali smo AIA-017 ACP transport spike i mind map belešku za ACP.
- Kako smo proverili: `git diff --check` i `rg` provere referenci.
- Sta jos nije pokriveno: pravi ACP runtime nije implementiran; ovo je za sada plan i arhitektura.
- Sledeci korak: odluciti da li prvo radimo AIA-017 ACP spike ili puni adapter za jednog agenta.

### 2026-07-08

- Sta smo hteli: dodati prvi pravi ACP slice u app.
- Sta smo promenili: dodali smo backend ACP stdio runtime, fake ACP proces, Tauri komande, adapter transport metadata i ACP test UI.
- Kako smo proverili: `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`.
- Sta jos nije pokriveno: pravi Codex/Claude/Kimi ACP adapter jos nije validiran; fake ACP je Unix shell fixture.
- Sledeci korak: probati realan ACP-compatible agent/wrapper ili nastaviti prvi puni real-agent adapter.

### 2026-07-08

- Sta smo hteli: da pre pravog ACP launch-a vidimo koje ACP opcije postoje.
- Sta smo promenili: dodali smo AIA-018 ACP Registry discovery, backend komandu, frontend listu kandidata i `Select` state.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`; posle `Select` izmene jos jednom `npm run typecheck`, `npm run test -- --run`, `git diff --check`.
- Sta jos nije pokriveno: jos ne pokrecemo codex-acp/claude-acp/kimi/gemini kao pravi ACP agent.
- Sledeci korak: izabrati jednog kandidata i napraviti real ACP launch path.

### 2026-07-08

- Sta smo hteli: da izabrani ACP kandidat moze stvarno da se pokrene iz app-a.
- Sta smo promenili: dodali smo `start_acp_registry_session` backend komandu i `Start Selected ACP` dugme.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`; posle UX korekcije jos jednom `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: Codex ACP radi kao smoke test, ali jos nije sredjen kao finalni adapter/workspace flow.
- Sledeci korak: izabrati da li prvo hardenujemo Codex ACP adapter, pravimo glavni workspace UI, ili uvodimo persistence/projekte.

### 2026-07-09

- Sta smo hteli: da ne pravimo Codex-specific ACP put, nego da `Start Selected ACP` bude pravi generic put za sve agente.
- Sta smo promenili: uklonili smo lokalni direct Codex ACP smer, dodali test za ne-default launchable kandidata, zakljucali selection dok ACP sesija radi i popravili prikaz Codex ACP thought/text-array eventova.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `tsc --noEmit`, `vitest --run`, `vite build`, `git diff --check`.
- Sta jos nije pokriveno: ovo je i dalje runtime test panel, ne finalni workspace UI; auth/permission/tool-call ACP tokovi nisu posebno dizajnirani.
- Sledeci korak: rucno testirati `Start Selected ACP`, pa commit ako izgleda dobro.

### 2026-07-09

- Sta smo hteli: da Codex ACP runtime bude stabilniji za realne zadatke pre UI polish-a.
- Sta smo promenili: razdvojili smo kratke control timeout-e od duzeg prompt timeout-a, dodali child-exit-aware cekanje, duplicate prompt guard i ostavili Stop/Drain dostupne dok prompt traje.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `tsc --noEmit`, `vitest --run`, `vite build`, `git diff --check`.
- Sta jos nije pokriveno: prompt submit je i dalje request/response tok, ne pravi background job model; to moze kasnije kad budemo radili finalni session UI.
- Sledeci korak: rucno testirati duzi Codex prompt i Stop tokom rada.

### 2026-07-09

- Sta smo hteli: da pocnemo pravi app deo, ne samo runtime test panel.
- Sta smo promenili: dodali smo SQLite project/workspace storage, backend komande `create_project`, `list_projects`, `delete_project`, minimalni Workspace panel i slanje izabranog project path-a kao `cwd` za PTY/ACP launch.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `tsc --noEmit`, `vitest run`, `vite build`, `git diff --check`.
- Sta jos nije pokriveno: nema native folder picker-a, session transcript/history persistence-a, default agenta/modela po projektu, ni finalnog workspace UI-ja.
- Sledeci korak: rucno dodati AIadne folder kao Workspace i proveriti da fake PTY i Codex ACP krecu iz tog foldera.

### 2026-07-09

- Sta smo hteli: malo srediti runtime UI pre nastavka razvoja.
- Sta smo promenili: dodali smo izbor `Terminal PTY` / `Structured ACP`, stavili agente u accordion, povecali output zonu, prikazujemo samo relevantan output za izabrani mode i spojili susedne Agent/Plan ACP evente da recenice ne budu iseckane.
- Kako smo proverili: `tsc --noEmit`, `vitest run`, `vite build`, `git diff --check`.
- Sta jos nije pokriveno: ovo jos nije finalni app UI; nema native folder picker-a, session istorije ni finalnog chat/tool-call prikaza.
- Sledeci korak: rucno proveriti da default ACP flow izgleda citljivije i da PTY fallback radi preko `Terminal PTY`.

### 2026-07-09

- Sta smo hteli: da app pocne da pamti ACP razgovore, a ne samo da ih prikaze dok je React state ziv.
- Sta smo promenili: dodali smo SQLite tabele `transcript_sessions` i `transcript_events`, backend transcript komande, frontend upis ACP user/agent eventa i mali `Session History` panel.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: ne postoji full replay/open transcript UI, search/filter history, ni PTY scrollback persistence.
- Sledeci korak: rucno proveriti da se posle ACP prompta history session pojavi i da event count raste.

### 2026-07-09

- Sta smo hteli: da `Session History` postane korisniji useru, ne samo lista sa brojem eventa.
- Sta smo promenili: klik na history sesiju sada poziva `list_transcript_events`, output prikazuje `Saved Transcript`, a `View Live ACP` vraca live ACP stream.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: nema search/filtera, nema continue-from-transcript flow-a i nema finalnog chat/tool-call dizajna.
- Sledeci korak: rucno kliknuti sacuvanu sesiju i proveriti da se stari razgovor prikaze u output panelu.

### 2026-07-09

- Sta smo hteli: popraviti history selekciju, spreciti mesanje poruka i osloboditi levi Runtime Test prostor.
- Sta smo promenili: history sada ima jedan selected row, transcript load ima request guard, saved replay ne spaja evente kao live stream, a levi sidebar sadrzi PTY/ACP mode, izbor agenta i status.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: finalni workspace/session layout i dalje nije napravljen; ovo je bolji test/product bridge.
- Sledeci korak: rucno proveriti vise history sesija i novi sidebar layout.

### 2026-07-09

- Sta smo hteli: popraviti sidebar overlap i pomeriti Session History levo.
- Sta smo promenili: agent selection je kompaktan accordion, `Session History` je u levom sidebaru, a sidebar ima poseban scroll da ne pregazi status.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: treba rucno pogledati u Tauri prozoru da vizuelno nema overlap-a na tvojoj rezoluciji.
- Sledeci korak: rucno pogledati UI u Tauri prozoru i potvrditi da history/agent accordion levo izgledaju dobro.

### 2026-07-09

- Sta smo hteli: da sacuvani history bude prava istorija pitanja i odgovora, a ne iseckani ACP stream.
- Sta smo promenili: pre cuvanja spajamo susedne agent/plan chunkove, a pri otvaranju starog transcript-a dodatno spajamo stare chunkove i prikazujemo `Question`/`Answer` labele.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: ovo jos nije finalni chat/tool-call UI; tool callovi su i dalje minimalni event redovi.
- Sledeci korak: rucno proveriti Codex saved transcript.

### 2026-07-09

- Sta smo hteli: da live ACP output sam skroluje i da history cuva stvarne odgovore, ne samo repove odgovora.
- Sta smo promenili: dodali smo auto-scroll na ACP event listu, `transcriptSessionRef` za stabilan aktivni transcript id i restart background drain intervala kad transcript id postane dostupan.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: stari transcript-i kojima ranije nisu upisani svi chunkovi ne mogu se rekonstruisati ako tekst nije u bazi.
- Sledeci korak: rucno proveriti novi Codex ACP transcript.

### 2026-07-09

- Sta smo hteli: da trenutni app izgleda lepse, stylish i pastelno, bez menjanja runtime logike.
- Sta smo promenili: dodali smo CSS design tokene, pastelnu pozadinu, mekse panele, lepse kontrole/focus/hover i obojene kartice za history, registry i ACP evente.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: ovo nije finalni product design; nema ikonice ni novi design system dependency.
- Sledeci korak: rucno pogledati UI u Tauri prozoru.

### 2026-07-09

- Sta smo hteli: da ceo app koristi lepsu, konkretnu paletu sa slike, a ne samo generic pastel.
- Sta smo promenili: globalni CSS tokeni sada koriste `#4F5743`, `#6B7460`, `#DCD1C3`, `#B29784` i `#483C32`, plus svetle izvedene nijanse; sredili smo font stack, pozadinu, panele, dugmad, inpute, sidebar, history i ACP event kartice.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: nismo dodavali custom font dependency ni finalni design system; ovo je vizuelni pravac za trenutni app.
- Sledeci korak: pokrenuti Tauri app i rucno proveriti da paleta izgleda dobro na realnom prozoru.

### 2026-07-10

- Sta smo hteli: da znanje iz jedne sesije moze rucno da postane kontekst za neku drugu sesiju, bez automatske magije.
- Sta smo promenili: dodali smo `Knowledge Cards` u SQLite, linkovanje kartica na transcript sesije, sidebar panel za create/attach i prompt injection za ACP.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: nema automatskog predlaganja kartica, embeddings search-a, konflikata, arhive, delete/detach UI-ja ni sensitive-content redaction-a.
- Sledeci korak: rucno napraviti karticu u Tauri app-u, cekirati je i poslati ACP prompt.

### 2026-07-10

- Sta smo hteli: da app ne izgleda kao da se nista ne desava dok cekamo Codex/ACP odgovor.
- Sta smo promenili: dok je ACP prompt u toku, prikazujemo `Waiting for agent response...` i pending karticu u ACP output-u.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: ovo nije pun streaming/progress timeline; samo minimalan waiting indikator.
- Sledeci korak: rucno poslati prompt Codex ACP agentu i proveriti da waiting nestane kad odgovor stigne.

### 2026-07-10

- Sta smo hteli: da `Session History` ne postane haos kad ima puno sacuvanih sesija.
- Sta smo promenili: dodali smo filter u sidebar history, broj match-eva, rename za trenutno izabranu transcript sesiju i ogranicili listu na 3 vidljive sesije.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: nema tagova, arhive/delete-a, grupisanja, ni pametnog ranking search-a.
- Sledeci korak: rucno kliknuti neku history sesiju, promeniti `Selected name`, kliknuti `Rename`, pa refresh i proveriti da ime ostaje.

### 2026-07-10

- Sta smo hteli: da ACP bude glavni runtime u UI-ju, a Terminal PTY da ne smeta dok nam ne zatreba kao backup.
- Sta smo promenili: uklonili smo veliki PTY/ACP switch, ACP Agents je primarni otvoreni panel, `Terminal PTY` je collapse-ovan fallback sa `Open PTY`, a status/session/pid/workspace su sklonjeni iz sidebar-a u mali info card gore desno u Runtime Controls.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: finalni workspace/session shell jos nije napravljen; ovo je samo sklanjanje PTY-a iz prvog plana.
- Sledeci korak: rucno proveriti da app startuje na ACP output-u, a PTY se vidi tek kad otvoris `Terminal PTY`.

### 2026-07-13

- Sta smo hteli: zapisati Project Initialize roadmap i krenuti od prvog malog koraka.
- Sta smo promenili: dodali smo AIA-039 do AIA-043 u Linear draftove, napravili project-level initialize preflight, backend tabele za run + izabrane repozitorijume i `Initialize Project` popup gde user bira repo-e koji ucestvuju.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Review nalaz: popravljen je stale UI status gde je Project Initialize `preflight` iz jednog projekta mogao da ostane prikazan posle prebacivanja na drugi projekat.
- Sta jos nije pokriveno: Facts, analiza markdown fajlova, interview guardrails i summary approval jos nisu implementirani; oni idu kao posebni sledeci slice-ovi.
- Sledeci korak: rucni review/manual commit za AIA-039, pa krenuti AIA-040 facts collection nad repo-ima koje je user izabrao.

### 2026-07-13

- Sta smo hteli: da Project delete bude vidljiv i bezbedan.
- Sta smo promenili: dodali smo `Delete Project` akciju za selektovani Workspace i confirmation popup; row-level `Delete` sada otvara isti popup, a backend `delete_project` se poziva tek posle potvrde.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: nema recycle/archive modela; delete ostaje trajno brisanje project record-a uz postojece backend pravilo da transcripts ostaju bez project link-a.
- Sledeci korak: rucni review/manual commit za AIA-044 zajedno sa lokalnim UI/workspace promenama.

### 2026-07-13

- Sta smo hteli: razjasniti zasto agent i dalje zna folder posle brisanja projekta i olaksati Add Project.
- Sta smo promenili: dodali smo Tauri dialog plugin, `Choose Folder` u Workspace formu, automatic project name iz izabranog foldera, delete success poruku i `Active Folder` u runtime sidebar-u. PTY/ACP session info sada vraca resolved `cwd`.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: repository path picker jos nije dodat; za sada native picker pokriva Add Project.
- Sledeci korak: rucno restartovati Tauri app i proveriti `Choose Folder`, delete success poruku i `Active Folder` dok ACP session radi.

### 2026-07-13

- Sta smo hteli: da brisanje projekta ne ostavi zive ACP agente u starom folderu.
- Sta smo promenili: confirmed Project delete sada prvo poziva `list_acp_sessions`, stopira svaku running ACP sesiju preko `stop_acp_session`, cisti active ACP UI state, pa tek onda poziva `delete_project`.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: PTY fallback session se jos ne stopira automatski na Project delete; ovo trenutno pokriva ACP, jer je to glavni runtime.
- Sledeci korak: rucni review/manual commit za AIA-046 zajedno sa lokalnim UI/workspace promenama.

### 2026-07-13

- Sta smo hteli: da kratke Workspace poruke ne zauzimaju prostor u panelu, nego iskacu dole desno i nestanu same.
- Sta smo promenili: dodali smo bottom-right toast stack, prebacili transient Workspace success/error poruke kroz njega, dodali auto-dismiss posle 4 sekunde i rucno zatvaranje.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: globalni notification centar/history ne postoji; toastovi su samo prolazne poruke.
- Sledeci korak: rucno u Tauri app-u dodati/obrisati projekat i proveriti toast poziciju, auto-dismiss i close dugme.

### 2026-07-13

- Sta smo hteli: da nastavimo Project Initialize faze i dobijemo prvu realnu analizu posle preflight-a.
- Sta smo promenili: dodali smo `project_initialization_facts` tabelu, backend komande za collect/list facts, lokalno git facts skupljanje za izabrane repo-e i `Collect Facts` UI sa prikazom rezultata.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Sta jos nije pokriveno: markdown analiza, interview guardrails i summary approval jos nisu implementirani; facts su samo deterministicki lokalni metadata.
- Sledeci korak: rucno u Tauri app-u kliknuti `Initialize Project`, zatim `Collect Facts`, pa proveriti status `facts` i listu facts-a.

### 2026-07-13

- Sta smo hteli: da Project Initialize analizira markdown fajlove iz izabranih repo-a.
- Sta smo promenili: dodali smo `project_initialization_markdown_findings` tabelu, backend komande za analyze/list markdown findings, deterministic markdown heading extraction i `Analyze Markdown` UI sa prikazom nalaza.
- Kako radi:
  - Markdown analysis je druga analiza posle `Initialize Project` preflight-a i Facts faze.
  - Radi samo nad repository-jima koje je user izabrao u Initialize popup-u za taj konkretan initialization run.
  - Za git repository koristi samo git-tracked markdown fajlove, preko git liste fajlova, da ne uvlaci dependency/cache/generated fajlove koji nisu deo source-a.
  - Za non-git repository koristi bounded filesystem fallback i preskace `.git`, `node_modules`, `dist`, `build`, `target`, `coverage`, `vendor`, `.next`.
  - Prioritet imaju `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, pa `docs/` markdown fajlovi.
  - Oversized markdown fajlovi se preskacu da analiza ostane brza i deterministicka.
  - Izvlaci document-level finding i heading-level findings za kategorije: setup, commands, conventions, warnings/fragile, architecture, decisions, process.
  - Svaki finding cuva repository, file path, category, title, excerpt i source attribution kao `README.md#setup`.
  - Rezultati se cuvaju u SQLite i mogu da se ponovo ucitaju kada se app restartuje.
  - Status initialization run-a prelazi na `markdown`.
  - Ovo su draft findings, ne approved knowledge; approval i final summary idu kasnije.
- Kako smo proverili: `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `npm run typecheck`, `npm run test -- --run`, `npm run build`, `git diff --check`.
- Review nalaz: clippy je trazio manji markdown helper context umesto previse argumenata i direktan `find_map(markdown_heading_text)`; popravljeno pre finalne validacije.
- Kako rucno da testiramo:
  - Startovati app sa `npm run tauri dev`.
  - Izabrati project koji ima bar jedan repository sa README/AGENTS/docs markdown fajlovima.
  - Kliknuti `Initialize Project` i potvrditi repository selection.
  - Kliknuti `Collect Facts`, pa `Analyze Markdown`.
  - Ocekivati toast `Markdown analyzed with X findings.`, status `markdown · N repositories` i listu nalaza sa category/source/excerpt redovima.
  - Restartovati app i proveriti da se findings ucitavaju iz baze za isti project/initialization.
- Sta jos nije pokriveno: interview guardrails i summary approval jos nisu implementirani; markdown nalazi su draft izvori, ne approved knowledge.
- Sledeci korak: rucno u Tauri app-u kliknuti `Analyze Markdown`, proveriti status `markdown` i nalaze sa file/source attribution.

### 2026-07-13

- Sta smo hteli: da Project Initialize deo izgleda manje kao debug lista i vise kao workflow koji moze brzo da se skenira.
- Sta smo promenili: podelili smo main content u tri lane-a: Workspace za project/repository controls, Project Initialization za initialize workflow, i Runtime skroz desno za ACP/PTY controls + Session Output. Workspace lane forme i action dugmad sada se slazu u kolonu/stack unutar lane-a, bez horizontalnog scroll-a. Dodali smo workflow header, phase rail za Preflight/Facts/Markdown/Interview/Summary, grupisali Facts po repository-ju i preuredili Markdown findings u redove sa category badge-om, naslovom, excerpt-om, repository-jem i source metadata.
- Dodatno: sidebar sekcije `ACP Agents`, `Session History`, `Knowledge Cards` i `Terminal PTY` sada inicijalno startuju collapsed.
- Dodatno: Facts i Markdown u Project Initialization lane-u vise nisu ogromne inline liste; sada su kompaktne preview kartice, a full detalji se otvaraju preko `View Facts` / `View Findings` modala.
- Dodatno: phase rail (`Preflight`, `Facts`, `Markdown`, `Interview`, `Summary`) sada je moderan compact mini-stepper u jednom redu bez horizontalnog scroll-a.

### 2026-07-13

- Sta smo hteli: da nastavimo sledecu Project Initialize fazu posle Facts i Markdown.
- Sta smo promenili: dodali smo Interview guardrails kao user-authored fazu. Backend ima `project_initialization_guardrails` tabelu, `save_project_initialization_guardrails` i `list_project_initialization_guardrails`; UI ima `Open Interview` modal gde mogu da se dodaju project-wide i repository-specific pravila za fragile, do-not-touch, needs-review i agent-rule.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Review nalaz: prvi backend save/list flow je drzao SQLite mutex dok opet poziva list, pa je Rust test visio; popravljeno je eksplicitnim drop-om connection guard-a pre listanja.
- Sta jos nije pokriveno: summary/review faza jos nije implementirana; Interview je manualni unos pravila, ne automatski guided questionnaire.
- Sledeci korak: AIA-043/AIA-044 style summary review koji kombinuje Facts, Markdown findings i Interview guardrails u reviewable project profile.
- Sta nismo menjali: backend komande, storage schema, repository selection, facts collection i markdown analysis logika ostaju isti.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sledeci korak: rucno pogledati da je Runtime lane skroz desno, Project Initialization odmah levo od njega, i da se suzavanje prozora ne raspada.

### 2026-07-13

- Sta smo hteli: da zavrsimo poslednju core Project Initialize fazu.
- Sta smo promenili: dodali smo Summary review. Backend ima `project_initialization_summaries` tabelu i komande `generate_project_initialization_summary`, `list_project_initialization_summary`, `approve_project_initialization_summary`. UI ima Phase 5 `Summary` card sa `Generate Summary` i `Approve Summary`.
- Kako radi: summary je deterministic draft iz Facts, Markdown findings i Interview guardrails. Sadrzi purpose, repository map, repository roles, build/test matrix, fragile areas, do-not-touch rules, agent working rules i open questions. Tek `Approve Summary` menja status profila u `approved`.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`, `cargo fmt --check`, `cargo test`, `cargo clippy -- -D warnings`, `git diff --check`.
- Sta jos nije pokriveno: approved knowledge se jos ne ubacuje automatski u ACP prompt context; kasniji Knowledge Unit rad je precizirao da prvo ide deterministicki selector sa preview-em i budzetom.
- Sledeci korak: rucno u Tauri app-u kliknuti `Generate Summary`, proveriti sekcije, zatim `Approve Summary` i potvrditi status `approved`.

### 2026-07-13

- Sta smo hteli: da Summary ne zauzima ceo Project Initialization lane dugackim tekstom.
- Sta smo promenili: Summary card sada prikazuje samo status, counts i kratku poruku; `View Summary` otvara modal sa svim sekcijama. `Approve Summary` je premesten u modal, da approval ide posle pregleda.
- Kako smo proverili: `npm run typecheck`, `npm run test -- --run`, `npm run build`.
- Sledeci korak: rucno proveriti da lane vise nema dugacki scroll kroz Summary i da modal lepo prikazuje ceo profile.

### 2026-07-14

- Sta smo hteli: da pripremimo Summary fazu za izbor razlicitih synthesis modela bez vezivanja UI-ja za jednog providera ili agent runtime.
- Sta smo promenili: dodat je backend model catalog sa providerima OpenAI/Anthropic/Moonshot, app tier-ovima fast/mid/high/max, capability metadata i proverljivim model profilima. Summary sada prima modelProfileId i cuva requested provider/model/tier/parameters plus schema verzije.
- Vazna granica: Summary je i dalje generisan lokalnim deterministic_v1 engine-om; izabrani model je samo trazeni synthesis target dok ne povežemo provider API.
- UI: Summary card ima tier segmented control, model dropdown, capability badges i provenance prikaz u preview-u i modal review-u.
- Sledeci korak: full validation i review, zatim poseban OpenAI Responses structured synthesis slice.

### 2026-07-14 - OpenAI Summary synthesis

- Problem: izbor modela je bio samo provenance; `Generate Summary` je i dalje prikazivao `deterministic_v1` i isti stari formatter rezultat.
- Promena: Summary sada stvarno poziva OpenAI Responses API sa izabranim OpenAI profilom, strict JSON Schema output-om, reasoning effort parametrom i `store=false`.
- Sigurnost: `OPENAI_API_KEY` ostaje u Rust procesu; ne ide kroz React i ne cuva se u SQLite. Repository tekst se tretira kao untrusted evidence, ne kao instrukcija.
- Konzistentnost: SQLite lock se ne drzi tokom mreze; validan odgovor se cuva samo ako se Facts/Markdown/Interview evidence nije promenio dok je model radio. Nema deterministic fallback-a.
- UI: provider bez adaptera ili OpenAI bez API kljuca je disabled sa jasnim razlogom. U uspesnom Summary modalu Generator je `openai_responses_v1`.
- Testovi: request/schema, completed/refusal/incomplete/malformed output, missing key/provider, empty sections, atomic preservation i stale evidence, plus frontend unavailable/provenance flow.

### 2026-07-14 - Knowledge Units i sledeci selector korak

- TL;DR: approved Summary je iscepan na male, source-backed Knowledge Units koje mogu nezavisno da se pregledaju i kasnije biraju za konkretan task.
- Sta je zavrseno: approval atomicki objavljuje deterministicke jedinice sa stabilnim ID-jem, kind/topic metadata, statusom, confidence vrednoscu, schema provenance-om i tacnim source key-evima; Summary Review prikazuje objavljene jedinice.
- Vazna granica: rucni Knowledge Cards i njihov whole-body prompt injection nisu menjani, a generisane jedinice se jos ne ubacuju automatski u agent prompt.
- Sledeci korak: deterministicki task-context selector koji ne menja sadrzaj jedinica, nego ih filtrira, rangira, redja i pakuje u strogi budzet prema tasku, repository/path scope-u i prioritetu obaveznih pravila.
- Preview zahtev: pre slanja agentu mora da se vidi koje jedinice ulaze, zasto ulaze i sta je izostavljeno zbog relevance-a ili budzeta.
- Embeddings: odlozeni su dok deterministicki selector ne postane merljiv baseline.

### 2026-07-14 - Summary approval Markdown heading fix

- Problem: provider je u strukturisana Summary polja dodao Markdown naslove kao `## Project purpose` i `## Needs confirmation`; line-level atomizer ih je pogresno tretirao kao necitirane knowledge tvrdnje i blokirao approval.
- Fix: validni ATX heading redovi se sada tretiraju samo kao struktura i ne postaju Knowledge Units; provider instrukcija dodatno zabranjuje redundantne heading-e unutar vec imenovanih polja.
- Safety: necitirani bullet/prose redovi se i dalje odbijaju pre bilo kakvog status update-a ili parcijalnog publikovanja.
- Provera: 75 Rust testova, 30 frontend testova, fmt, clippy, typecheck, production build i diff check prolaze.
- Rucni retest: restartovati Tauri app sa novim binarnim kodom i ponovo kliknuti `Approve Summary` na postojecem draft-u; nije potrebno ponovo zvati OpenAI.

### 2026-07-14 - Summary source citation correction

- Problem: OpenAI je ponekad vracao genericki marker `[source: evidence pack]`, koji strict validator ispravno odbija jer nije tacan source label iz initialization evidence-a.
- Fix: svaki request sada eksplicitno sadrzi sortiranu/deduplikovanu `allowed_source_labels` listu i zabranjuje genericke source nazive.
- Recovery: ako prvi kompletan draft padne source validaciju, backend pravi tacno jedan correction request sa skracenim, JSON-enkodovanim i untrusted validator feedback-om.
- Safety: nepoznat source se nikad ne mapira ili prihvata; drugi invalidan odgovor ostaje greska i nijedan los draft se ne cuva.
- Provera: 76 Rust testova, 30 frontend testova, fmt, clippy, typecheck, production build i diff check prolaze.
- Rucni retest: restartovati Tauri app i kliknuti `Generate Summary`; jedna akcija moze napraviti drugi OpenAI poziv samo ako prvi output padne source proveru.

### 2026-07-14 - Deterministicki task-context selector preview

- Sta je dodato: backend selector bira samo active Knowledge Units, daje prioritet constraint/agent_rule jedinicama, zatim repository/path i exact lexical poklapanju, i pakuje rezultat u podrazumevani budzet od 6000 karaktera.
- Explainability: svaki included/excluded rezultat ima reason i score; `needs_confirmation` se uvek izostavlja iz potvrdjenog konteksta.
- UI: `Preview Context` uz ACP prompt prikazuje budget/used/remaining, ordered included units, omissions i exact rendered context.
- Vazna granica: preview jos ne menja `Send ACP`; agent i dalje automatski dobija samo rucno zakacene Knowledge Cards.
- Provera: 80 Rust testova, 30 frontend testova, fmt, clippy, typecheck, build i diff check prolaze.
- Sledece: rucno probati vise realnih taskova i proveriti quality razloga/izbora pre opt-in prompt injection-a ili embeddings-a.
### 2026-07-21 - Project Initialization lane extraction

- Izdvojena je kompletna Initialization traka (phase rail, Preflight, Facts, Markdown, Interview i Summary kompozicija) u state-free feature komponentu.
- `App.tsx` je smanjen sa 2.522 na 2.204 linije; async Tauri workflow, modali i persistence ostaju u koordinatoru.
- Provera: 127 frontend testova, typecheck, production build, Tauri boundary i diff check prolaze; slede PTY runtime kontrole.
### 2026-07-21 - PTY runtime controls extraction

- PTY status, terminal dimensions i akcije Use ACP/Start/Drain/Resize/Stop/Kill izdvojene su u state-free runtime komponentu.
- Lock pravila razlikuju postojanje sesije od upotrebljive sesije, a Stop/Kill zadržavaju graceful/force semantiku.
- Provera: 131 frontend test, typecheck, production build, Tauri/xterm boundary i diff check prolaze; `App.tsx` ima 2.161 liniju.
### 2026-07-21 - Typed Tauri gateway

- Svih 44 dozvoljenih backend komandi sada prolazi kroz jedan eksplicitan frontend gateway; `App.tsx` vise ne uvozi Tauri core direktno.
- Gateway cuva tacan oblik poziva, payload, rezultat i gresku, pa naredni feature hook-ovi zavise od nase granice umesto framework API-ja.
- Provera: 134 frontend testa, typecheck, production build, direct-import boundary i diff check prolaze.
### 2026-07-21 - PTY terminal lifecycle hook

- Kreiranje i cleanup xterm/FitAddon instance, input forwarding, ResizeObserver i imperative fit/focus/reset/write operacije izdvojeni su u `usePtyTerminal`.
- Hook koristi aktuelne ref vrednosti, pa promena sesije ili callback-a ne remountuje terminal; `App.tsx` je pao na 2.062 linije.
- Provera: 136 frontend testova, typecheck, production build, xterm boundary i diff check prolaze.
### 2026-07-21 - Modern frontend skill i audit

- Dodat je projektni `aiadne-modern-frontend` skill koji se obavezno koristi za svaki React/TypeScript frontend rad i review.
- Audit blokira rast `App.tsx` preko 2.200 linija, feature module preko 250, direktne Tauri/xterm importe, `any`/`@ts-ignore` i feature komponente bez colocated testa.
- Audit je pronasao stvarnu rupu: `NotificationViewport` je dobio behavior/accessibility i cleanup testove.
- Provera: skill validator, frontend audit, typecheck, 138 testova i production build prolaze.
### 2026-07-21 - Project catalog hook

- Project/repository state, derivacija, forme, dijalozi, folder picker i CRUD izdvojeni su u `useProjectCatalog`; cross-domain brisanje ostaje privremeni App coordinator.
- Repository refresh koristi request identity, pa stari odgovor ne moze pregaziti noviji izbor projekta.
- `App.tsx` je pao sa 2.062 na 1.882 linije; audit, typecheck, 142 testa i build prolaze.
### 2026-07-21 - Initialization evidence hook

- Initialization identity i Facts/Markdown/Guardrails/Summary/Knowledge Unit cache i refresh logika izdvojeni su u `useInitializationEvidence`.
- Project i evidence request identity sprecavaju stare async odgovore; Summary approval ima poseban Knowledge Unit refresh.
- `App.tsx` je pao sa 1.882 na 1.636 linija; audit, typecheck, 145 testova i build prolaze.
### 2026-07-21 - Project Initialization workflow hook

- Start scope, Facts/Markdown akcije, Interview forma/validacija/save i Summary generate/approve izdvojeni su u `useProjectInitializationWorkflow`.
- Workflow komunicira sa evidence hook-om samo kroz semanticke akcije; `App` vise nema initialization forme ni backend workflow.
- `App.tsx` je pao sa 1.636 na 1.361 liniju; audit, typecheck, 149 testova i build prolaze.
### 2026-07-21 - Knowledge workspace hook

- Knowledge Card load/forma/create, attachments i task-context preview izdvojeni su u `useKnowledgeWorkspace`.
- Hook cuva active transcript source, project/global scope, stale project-load identity i tacan selector budget/payload.
- `App.tsx` je pao sa 1.361 na 1.218 linija; audit, typecheck, 153 testa i build prolaze.
### 2026-07-21 - Transcript workspace hook

- Transcript list/current/saved replay/rename/event persistence i Task indeks izdvojeni su u `useTranscriptWorkspace`.
- ACP koristi semanticke session/Task accessor akcije; project i replay request identity sprecavaju stale overwrite.
- `App.tsx` je pao sa 1.218 na 963 linije; audit, typecheck, 157 testova i build prolaze.

### 2026-07-21 - ACP runtime hook

- ACP registry, session start/stop, coding model, prompt/Task/transcript koordinacija, event polling i delete cleanup izdvojeni su u `useAcpRuntime`.
- App sada samo spaja ACP runtime sa izabranim workspace-om, Knowledge prilozima i transcript API-jem.
- `App.tsx` je pao sa 963 na 769 linija; audit, typecheck, 160 testova i build prolaze.

### 2026-07-21 - PTY process runtime hook

- PTY session/output/start/resize/drain/stop i terminal koordinacija izdvojeni su u `usePtyRuntime`, koji komponuje postojeci `usePtyTerminal`.
- App prosledjuje samo runtime mode, workspace cwd i Codex Doctor readiness; procesni payload-i i polling ostaju isti.
- `App.tsx` je pao sa 769 na 656 linija; audit, typecheck, 163 testa i build prolaze.

### 2026-07-21 - Agent environment hook

- Agent Doctor discovery/error/refresh i synthesis model catalog/tier/profile izbor izdvojeni su u `useAgentEnvironment`.
- Summary provenance vraca prethodni synthesis izbor, stale refresh odgovori se ignorisu, a ACP coding model ostaje odvojena session odluka.
- `App.tsx` je pao sa 656 na 558 linija; audit, typecheck, 167 testova i build prolaze.

### 2026-07-21 - Project deletion hook

- Project delete candidate/error, ACP-first shutdown, backend delete, catalog/evidence cleanup i success toast izdvojeni su u `useProjectDeletion`.
- Cleanup je atomski sa frontend strane: ako ACP shutdown ili backend delete ne uspe, lokalni domeni se ne uklanjaju i potvrda ostaje otvorena.
- `App.tsx` je 519-linijski composition root bez backend poziva; audit, typecheck, 170 testova i build prolaze.

### 2026-07-21 - PTY xterm code splitting

- xterm, FitAddon i njihov CSS se dinamicki ucitavaju tek kada korisnik udje u PTY fallback mod; kasni import posle unmount/mode promene ne montira terminal.
- Pocetni JS je pao sa oko 611 kB na 281.69 kB; xterm je zaseban 329.31 kB chunk i Vite vise nema chunk-size warning.
- Frontend modularizacija je zavrsena: audit, typecheck, 171 test i production build prolaze.

### 2026-07-21 - Immutable Task phase artifacts

- Dodate su append-only `task_phase_artifacts` i normalizovane veze ka transcript event izvorima; svaki izvor mora pripadati istoj Task transcript sesiji.
- Artefakti imaju per-phase sequence, a provenance se vraca canonical redom transcript event-a i deduplikuje bez gubitka integriteta.
- Registrovane su tipizovane create/list Tauri komande; 93 Rust testa, 171 frontend test, fmt, clippy, audit, typecheck i build prolaze.

### 2026-07-21 - Evidence-gated Task phase state machine

- Dodat je transakcioni `transition_task_phase` sa eksplicitnim `start` i `complete` akcijama kroz analysis, planning, execution i review.
- Samo aktuelna in-progress faza prima artefakte; completion bez artefakta, skip, dupli start i transition zavrsenog Task-a se odbijaju.
- Review completion zavrsava Task; 93 Rust testa, 171 frontend test, fmt, clippy, audit, typecheck i build prolaze.

### 2026-07-21 - Task Phase panel

- ACP workspace sada prikazuje cetiri Task faze, njihove statuse i artefakte, uz rucne Start/Add evidence/Complete akcije.
- Evidence bira samo persisted live transcript event ID-jeve; hook ignorise stare async rezultate posle promene Task-a.
- App ostaje composition root; 93 Rust testa, 177 frontend testova, fmt, clippy, audit, typecheck i build prolaze.

### 2026-07-21 - Unified Task Context Preview

- Preview sada spaja odobrene Project Knowledge Units, transcript-attached Knowledge Cards i artefakte aktivnog Task-a pod jednim strogim character budget-om.
- Svaka stavka prikazuje source type i razlog izbora; backend proverava project/initialization/transcript/Task vlasnistvo, a stale frontend odgovor se odbacuje.
- Nema automatskog slanja ACP agentu; 94 Rust testa, 178 frontend testova, fmt, clippy, typecheck i production build prolaze.

### 2026-07-21 - Explicit Task Context Send

- Preview ima eksplicitno `Send with this context`; ACP wire payload dobija tacno pregledani context, dok Task originalPrompt i transcript user event ostaju originalni.
- Prazan context, nedostupan ACP, slanje u toku i brzi dupli klik ne mogu proizvesti dodatni zahtev; neuspeh ostavlja dialog otvoren za retry.
- Frontend skill audit, 183 frontend testa, 94 Rust testa, typecheck, build, fmt i clippy prolaze.

### 2026-07-22 - Auditable Context Dispatch Receipts

- Svaki eksplicitni context send prvo dobija trajni `pending` Task receipt, pa se posle ACP odgovora finalizuje kao `sent` ili `failed`.
- Receipt cuva exact prompt/context/wire tekst, source snapshot, ACP session, stop reason/gresku i stabilan per-Task sequence; interrupted send ostaje konzervativno `pending`.
- Frontend audit, 182 frontend testa, 96 Rust testova, typecheck, build, fmt i clippy prolaze; App ostaje na 534 linije.

### 2026-07-22 - Context Dispatch History and Safe Recovery

- Task workspace sada prikazuje ordered receipt istoriju sa tacnim sacuvanim prompt/context tekstom, izvorima i ACP ishodom.
- Samo `pending` receipt moze rucno da postane `failed`, uz obavezan razlog; backend odbija promenu dok je vezana ACP sesija aktivna i nikad ne dozvoljava lazni `sent`.
- Frontend audit, 187 frontend testova, 96 Rust testova, typecheck, build, fmt i clippy prolaze; `App.tsx` ostaje composition root sa 547 linija.
