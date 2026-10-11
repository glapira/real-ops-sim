/* Sample data in the exact shape of GET ops_room and GET ops_graph.
   Example values only: the live page passes the real JSON to update()/updateGraph(). */
(function (root) {
  const now = new Date();
  const iso = mins => new Date(now.getTime() + mins * 60000).toISOString();
  const nextTop = new Date(now); nextTop.setUTCMinutes(0, 0, 0); nextTop.setUTCHours(nextTop.getUTCHours() + 1);

  const A = (id, name, role, role_es, team, model, effort, state, task, task_es, items, runs, last, schedule) => ({
    id, name, name_es: name, role, role_es, team, model, effort, schedule: schedule || 'On call', schedule_es: schedule ? schedule.replace('Hourly', 'Cada hora') : 'A demanda',
    state, since: iso(-40 - items * 3), task, task_es, today: { runs, items }, last: last ? { at: iso(-last[0]), what: last[1], what_es: last[2] || last[1] } : null
  });

  const agents = [
    A('jarvis', 'Jarvis', 'Mail, books and cards', 'Correo, libros y fichas', 'cloud', 'Opus 5.5', 'high', 'working', 'Sweeping the inbox', 'Barriendo la bandeja', 14, 6, [12, 'Booked a handling invoice', 'Asentó una factura de handling'], 'Hourly 05–21 UTC'),
    A('contract-desk', 'Contract desk', 'Reads and redlines contracts', 'Lee y revisa contratos', 'cloud', 'Opus 5.5', 'high', 'resting', '', '', 3, 2, [55, 'Flagged a renewal clause', 'Marcó una cláusula de renovación']),
    A('second-opinion', 'Second opinion', 'Checks the big calls twice', 'Revisa dos veces lo importante', 'cloud', 'Fable 5.1', '', 'off', '', '', 1, 1, [180, 'Agreed with a fuel price check', 'Confirmó un precio de combustible']),
    A('reader', 'Reader', 'Reads PDFs inside the ledger', 'Lee PDF dentro del libro', 'ledger', 'Sonnet 5.5', '', 'working', 'Reading a fuel statement', 'Leyendo un extracto de combustible', 9, 9, [6, 'Read a crew hotel invoice', 'Leyó una factura de hotel']),
    A('assistant', 'Assistant', 'Answers your questions in the ledger', 'Responde tus preguntas en el libro', 'ledger', 'Sonnet 5.5', '', 'resting', '', '', 4, 4, [70, 'Answered a cost question', 'Respondió una pregunta de costes']),
    A('mac-clerk', 'Mac clerk', 'PDFs, backup and vault on the Mac', 'PDF, copia y bóveda en el Mac', 'mac', 'Sonnet 5.5', '', 'working', 'Filing 3 PDFs', 'Archivando 3 PDF', 22, 5, [3, 'Filed a navigation charges PDF', 'Archivó un PDF de tasas']),
    A('memory-curator', 'Memory curator', 'Keeps Jarvis memory tidy', 'Ordena la memoria de Jarvis', 'mac', 'Opus 5.5', '', 'off', '', '', 0, 0, null, 'Weekly'),
    A('router', 'Router', 'Main coding session', 'Sesión principal de código', 'code', 'Opus 5.5', 'high', 'working', 'Planning the ops room', 'Planificando la sala', 2, 2, [20, 'Merged the parser fix', 'Integró el arreglo del parser']),
    A('triage', 'Triage', 'Sorts incoming code jobs', 'Clasifica trabajos de código', 'code', 'Haiku 5.5', '', 'resting', '', '', 3, 3, [90, 'Sorted 3 jobs', 'Clasificó 3 trabajos']),
    A('scout', 'Scout', 'Reads the codebase first', 'Lee el código primero', 'code', 'Sonnet 5.5', '', 'working', 'Mapping the views', 'Mapeando las vistas', 4, 4, [8, 'Found the menu entry', 'Encontró la entrada del menú']),
    A('quick', 'Quick', 'Small fixes', 'Arreglos pequeños', 'code', 'Sonnet 5.5', '', 'off', '', '', 0, 0, null),
    A('build', 'Build', 'Writes the change', 'Escribe el cambio', 'code', 'Opus 5.5', '', 'resting', '', '', 2, 2, [40, 'Wrote the import fix', 'Escribió el arreglo de importación']),
    A('deep', 'Deep', 'Hard problems', 'Problemas difíciles', 'code', 'Opus 5.5', 'xhigh', 'off', '', '', 0, 0, null),
    A('escalate', 'Escalate', 'Last resort reviewer', 'Revisor de último recurso', 'code', 'Fable 5.1', '', 'off', '', '', 0, 0, null),
    A('verifier', 'Verifier', 'Runs the checks', 'Pasa las pruebas', 'code', 'Sonnet 5.5', '', 'working', 'Running smoke tests', 'Pasando pruebas', 5, 5, [15, 'All smoke tests green', 'Todas las pruebas en verde']),
    A('workflow', 'Workflow', 'Runs multi-step jobs', 'Ejecuta trabajos en varios pasos', 'code', 'Opus 5.5', '', 'off', '', '', 1, 1, [300, 'Finished a nightly check', 'Terminó una revisión nocturna'])
  ];

  const feedSrc = [
    [-180, 'jarvis', 'Booked a fuel invoice to the ledger', 'Asentó una factura de combustible'],
    [-165, 'mac-clerk', 'Filed a navigation charges PDF', 'Archivó un PDF de tasas de navegación'],
    [-150, 'reader', 'Read a crew hotel invoice', 'Leyó una factura de hotel de tripulación'],
    [-140, 'contract-desk', 'Flagged a renewal clause in a service contract', 'Marcó una cláusula de renovación'],
    [-128, 'jarvis', 'Updated a negotiation card', 'Actualizó una ficha de negociación'],
    [-115, 'verifier', 'Smoke tests green after the parser fix', 'Pruebas en verde tras el arreglo del parser'],
    [-102, 'jarvis', 'Drafted a reply about a handling quote', 'Redactó una respuesta sobre un presupuesto de handling'],
    [-90, 'reader', 'Read a bank statement', 'Leyó un extracto bancario'],
    [-80, 'mac-clerk', 'Nightly backup checked', 'Copia nocturna comprobada'],
    [-66, 'jarvis', 'Logged a payment confirmation', 'Registró una confirmación de pago'],
    [-55, 'build', 'Wrote the import date fix', 'Escribió el arreglo de la fecha de importación'],
    [-44, 'jarvis', 'Matched a training invoice to its card', 'Asoció una factura de formación a su ficha'],
    [-35, 'second-opinion', 'Agreed with a fuel price check', 'Confirmó la revisión de precio de combustible'],
    [-25, 'reader', 'Read a parts quote', 'Leyó un presupuesto de repuestos'],
    [-14, 'mac-clerk', 'Filed 3 supplier PDFs to the vault', 'Archivó 3 PDF de proveedores'],
    [-6, 'jarvis', 'Booked a handling invoice', 'Asentó una factura de handling']
  ];
  const feed = feedSrc.map(([m, agent, what, what_es]) => ({ at: iso(m), agent, what, what_es, link: '#/ledger' }));
  const arrivals = [
    [-120, 'Fuel statement for September', 'Extracto de combustible de septiembre'],
    [-70, 'Handling invoice', 'Factura de handling'],
    [-30, 'Contract draft for review', 'Borrador de contrato para revisar'],
    [-9, 'Crew training invoice', 'Factura de formación de tripulación']
  ].map(([m, what, what_es]) => ({ at: iso(m), what, what_es, link: '#/inbox' }));
  const departures = [
    [45, 'Reply to the fuel supplier', 'Responder al proveedor de combustible'],
    [120, 'Pay the handling invoice', 'Pagar la factura de handling'],
    [300, 'Renewal decision on the service contract', 'Decidir la renovación del contrato'],
    [1440, 'Monthly close', 'Cierre mensual'],
    [2880, 'Insurance documents due', 'Vencen los documentos del seguro']
  ].map(([m, what, what_es]) => ({ due: iso(m), what, what_es, link: '#/cards' }));

  root.OPS_SAMPLE_ROOM = {
    now: now.toISOString(),
    next_run_at: nextTop.toISOString(),
    clocks: { local: { tz: 'Europe/Madrid', label: 'Madrid', at: now.toISOString() }, zones: ['Europe/Madrid', 'America/Aruba', 'America/Argentina/Buenos_Aires', 'UTC'] },
    usage: { five_hour: 47, seven_day: 71, cap: 80, resets_at: iso(60 * 50), at: now.toISOString() },
    agents, departures, arrivals, feed
  };

  // graph: cards, parties, notes, documents and people
  const types = [['card', 34], ['party', 30], ['note', 26], ['doc', 40], ['person', 18]];
  const words = {
    card: ['Fuel contract', 'Handling rates', 'Training renewal', 'Parts pool', 'Insurance', 'Charts subscription', 'FDM service', 'Hangar slot', 'Crew hotel deal', 'Navigation fees'],
    party: ['Fuel supplier', 'Handling agent', 'Training centre', 'MRO shop', 'Insurer', 'Charts provider', 'Bank', 'Caterer', 'Hotel group', 'Lawyer'],
    note: ['Payment terms', 'Price check', 'Contact preference', 'VAT rule', 'Approval rule', 'Rate history'],
    doc: ['Invoice', 'Statement', 'Quote', 'Contract PDF', 'Receipt', 'Credit note'],
    person: ['Account manager', 'Ops contact', 'Sales lead', 'Finance contact', 'Crew planner']
  };
  const stages = ['signed', 'waiting', 'reminder', 'declined', 'snoozed'];
  const nodes = []; let id = 1;
  types.forEach(([t, n]) => { for (let i = 0; i < n; i++) nodes.push({ id: t + '-' + (id++), type: t, label: words[t][i % words[t].length] + (i >= words[t].length ? ' ' + (Math.floor(i / words[t].length) + 1) : ''), group: t, stage: t === 'card' ? stages[i % stages.length] : '', weight: 1 + (i % 4), hot: i % 7 === 0 }); });
  const edges = [];
  nodes.forEach((n, i) => { if (n.type !== 'party') { const p = nodes.filter(x => x.type === 'party'); edges.push({ s: n.id, t: p[i % p.length].id, kind: 'rel' }); } if (n.type === 'doc') { const c = nodes.filter(x => x.type === 'card'); edges.push({ s: n.id, t: c[i % c.length].id, kind: 'doc' }); } });
  root.OPS_SAMPLE_GRAPH = { at: now.toISOString(), nodes, edges };
})(window);
