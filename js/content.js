// All site copy. Every user-facing string exists in en and pt (tests/content.test.mjs enforces it).
export const SECTIONS = ['hero', 'journey', 'stack', 'articles', 'repos', 'recs', 'contact'];

export const stops = [
  { id: 'hero', section: 'hero', year: 'HELLO', country: 'BR' },
  { id: 'puc', section: 'journey', year: '2003', country: 'BR', brand: { initials: 'PUC', color: '#1e3a8a' } },
  { id: 'arizona', section: 'journey', year: '2011', country: 'BR', brand: { initials: 'AP', color: '#b91c1c' } },
  { id: 'insane', section: 'journey', year: '2012', country: 'BR', brand: { initials: 'IG', color: '#7b2cbf' } },
  { id: 'taqtile', section: 'journey', year: '2014', country: 'BR', brand: { initials: 'TQ', color: '#0e7490' } },
  { id: 'mira', section: 'journey', year: '2017', country: 'BR', brand: { initials: 'ME', color: '#c2410c' } },
  { id: 'reclame', section: 'journey', year: '2017', country: 'BR', brand: { initials: 'RA', color: '#15803d' } },
  { id: 'move', section: 'journey', year: '2019', country: 'UK' },
  { id: 'millimetric', section: 'journey', year: '2020', country: 'UK', brand: { initials: 'MM', color: '#2b59c3' } },
  { id: 'xdesign', section: 'journey', year: '2020', country: 'UK', brand: { initials: 'XD', color: '#be123c' } },
  { id: 'olm', section: 'journey', year: '2021', country: 'UK', brand: { initials: 'OLM', color: '#0f766e' } },
  { id: 'glasgow', section: 'journey', year: '2023', country: 'UK', brand: { initials: 'OLM', color: '#0f766e' } },
  { id: 'tribal', section: 'journey', year: '2024', country: 'UK', brand: { initials: 'TW', color: '#e2001a' } },
  { id: 'stack', section: 'stack', year: 'STACK', country: 'UK' },
  { id: 'articles', section: 'articles', year: 'WRITE', country: 'UK' },
  { id: 'repos', section: 'repos', year: 'CODE', country: 'UK' },
  { id: 'recs', section: 'recs', year: 'KIND', country: 'UK' },
  { id: 'contact', section: 'contact', year: 'NOW', country: 'UK' },
];

export const sectionStart = (section) => stops.findIndex(s => s.section === section);

export const links = {
  email: 'mailto:samuel.catalano@gmail.com',
  linkedin: 'https://www.linkedin.com/in/samuelcatalano',
  github: 'https://github.com/samuelcatalano',
  medium: 'https://medium.com/@samuelcatalano',
  cv: 'assets/samuel-catalano-cv.pdf', // address and phone redacted from the source CV
};

export const articles = [
  { title: 'Mastering the Art of Backend Hiring', url: 'https://medium.com/thefreshwrites/mastering-the-art-of-backend-hiring-essential-questions-for-interviewers-and-candidates-e0deb436f8ff' },
  { title: 'Quarkus and the MicroProfile Fault Tolerance API', url: 'https://medium.com/thefreshwrites/quarkus-and-a-microprofile-fault-tolerance-api-fee82de09616' },
  { title: 'Mapping Entities to DTOs and vice versa in Java', url: 'https://medium.com/thefreshwrites/mapping-entities-to-dtos-and-vice-versa-in-java-fe126f6bb6b2' },
];

const LANG_COLOR = { Java: '#b07219', Kotlin: '#a97bff', Go: '#00add8', Groovy: '#4298b8' };
export const repos = [
  { name: 'quarkus-fault-tolerance', lang: 'Java · Quarkus' },
  { name: 'quarkus-mongo-crud', lang: 'Java · Quarkus · MongoDB' },
  { name: 'kerno-kotlin-challenge', lang: 'Kotlin' },
  { name: 'neo4j-tech-challenge', lang: 'Java · Neo4j' },
  { name: 'bookstore-basic-golang', lang: 'Go' },
  { name: 'groovy-rest-crud-sample', lang: 'Groovy' },
].map(r => ({ ...r, url: `https://github.com/samuelcatalano/${r.name}`, color: LANG_COLOR[r.lang.split(' · ')[0]] }));

// Grouped like tube lines: one colour per line, each tool a station. Names live in i18n sections.stack.groups.
export const stackGroups = [
  { id: 'core', color: '#d4352e', items: ['Java 17', 'Spring Boot', 'Quarkus', 'JUnit · Mockito'] },
  { id: 'messaging', color: '#1f3fbf', items: ['Kafka', 'Debezium', 'ActiveMQ', 'SNS/SQS'] },
  { id: 'cloud', color: '#0c7a3d', items: ['AWS Lambda', 'Docker', 'Kubernetes', 'Terraform'] },
  { id: 'data', color: '#7a3b9e', items: ['PostgreSQL', 'MySQL', 'MongoDB', 'Cassandra'] },
];
// Third-party 3D models that ship in the runtime and need attribution; kept in sync with ASSET_SOURCES.md by tests/content.test.mjs.
const BY = ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'], NCSA = ['CC BY-NC-SA 4.0', 'https://creativecommons.org/licenses/by-nc-sa/4.0/'];
export const credits = [
  { name: 'Mini Cooper S Hardtop 2011', author: 'Nieve5677', url: 'https://sketchfab.com/iori308408', lic: BY },
  { name: 'London Black Cab (LTI TX4)', author: 'Nieve5677', url: 'https://sketchfab.com/iori308408', lic: BY },
  { name: 'Toyota Corolla 2020', author: 'ItsDiyor', lic: BY },
  { name: 'Honda HR-V e:HEV 2022', author: 'tonielpro520', url: 'https://sketchfab.com/tonielpro520', lic: BY },
  { name: 'Mercedes-Benz E63 AMG S Wagon 2018', author: 'SINNIK', url: 'https://sketchfab.com/sinnik', lic: BY },
  { name: 'Volkswagen T-Cross 2021', author: 'Ddiaz Design', url: 'https://sketchfab.com/ddiaz-design', lic: NCSA },
  { name: 'Nissan Qashqai 2018', author: 'Ddiaz Design', url: 'https://sketchfab.com/ddiaz-design', lic: NCSA },
  { name: 'Land Rover Range Rover Supercharged 2008', author: 'Ddiaz Design', url: 'https://sketchfab.com/ddiaz-design', lic: NCSA },
  { name: 'Realistic Tree', author: 'Daniel', url: 'https://sketchfab.com/danielpetrov', lic: BY },
];
export const stack = stackGroups.flatMap(g => g.items);

export const i18n = {
  en: {
    ui: {
      nav: { journey: 'Journey', stack: 'Stack', articles: 'Writing', repos: 'Code', recs: 'Recommendations', contact: 'Contact' },
      theme: 'Switch between day and night', auto: 'Auto-ride: let the bus drive itself', sound: 'Sound: city, weather and traffic', photo: 'Save a postcard of this view', rideTime: 'Automatic ride ≈ {auto} s · quick tour ≈ {quick} s', progressEmpty: 'Start with the first stop · quick tour ≈ {quick} s', nextStop: 'Next stop', ticketSince: 'since {year}', ticketStops: '{n} stops', voice: 'Voice: announce each stop', speak: 'Now arriving at {title}. Please mind the gap.', svcGood: 'Good service', svcAll: 'Good service on all lines', quickProgress: 'Quick tour: {count}/{total} main stops', reset: 'Start the route again', resetConfirm: 'Clear your progress on this device?', foundHint: { hide: 'Press H to hide the panel.', postcard: 'Save a postcard of this view.' }, recap: { title: 'Route ticket', stops: 'Stops', cities: 'Cities', tools: 'Tools seen', found: 'Found' }, found: { hide: 'Found it: the city without the panel.', postcard: 'Found it: a postcard for the passport.' }, lang: 'Switch language', scroll: 'Scroll to ride', scrollTouch: 'Swipe to ride',
      zones: { br: 'Brazil', uk: 'United Kingdom' }, cities: { sp: 'São Paulo', ldn: 'London', gla: 'Glasgow' }, arriving: 'Now arriving', quick: 'Quick tour: the main stops only', hide: 'Hide the interface and see the city', hideShort: 'Hide the interface (H)', show: 'Show the interface (H)', passport: 'Passport', progress: '{count} of {total} career stops visited', finishComplete: 'You visited all {total} career stops. Thanks for riding.', finishContinue: 'You visited {count} of {total} career stops. The full route is in Journey.', credits: { link: 'Credits and how it was made', title: 'Credits', intro: 'Third-party 3D models, used under their licences and converted, merged and compressed for the web.', built: 'How it was made', items: ['Plain HTML, CSS and ES modules: no build step, no framework.', 'Three.js draws the city: instanced buildings, authored landmarks and adaptive quality.', 'Automated tests run on every push.', 'The buses, buildings and landmarks are original work; people use CC0 base meshes.'], close: 'Close' }, usedAt: 'Used at', clearFilter: 'Show every stop', led: { gap: 'Mind the gap', rain: 'Delayed: rain', end: 'All change', stop: 'Stop requested', horn: 'Beep beep', final: 'Final stop. Thanks for riding', count: 'Stops {count}/{total}', found: 'Found something' }, clock: 'London right now', loading: 'Warming up the bus…', intro: { owner: 'Samuel Catalano', ticket: 'Travel ticket', ticketNumber: 'Ticket No. 0083', passenger: 'Passenger: you', stages: { vehicles: 'Traffic', landmarks: 'Landmarks', npc: 'People', buildings: 'Buildings', vegetation: 'Trees', city: 'City' }, ready: 'All aboard', start: 'Start the journey', loadingBtn: 'Preparing your journey', finishing: 'Getting ready to depart', loaded: 'Ready to depart.', greet: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }, title: 'Next stop: the journey', sub: 'Senior backend & platform engineer, 17+ years: from São Paulo to the UK.', hint: 'Scroll to explore · {→} forward · {←} back', t_hint: 'Swipe to drive', skip: 'Skip', d1: 'São Paulo', d2: 'London', d3: 'Glasgow' }, navLabel: 'Sections', beforeLondon: 'Before London', present: 'Present', skip: 'Skip to content', footer: 'Designed and built by Samuel Catalano.',
      signpost: { saoPaulo: 'São Paulo', london: 'London', km: '9,480 km' }, // 3D fingerpost on the plaza over the SP -> London tunnel
    },
    sections: {
      hero: { title: 'Samuel Catalano', kicker: 'Backend & platform engineering', role: 'Senior Software Engineer', value: 'Backend engineer for systems that keep working after launch.', proof: 'Samuel is a committed, serious and extremely responsible professional.', tagline: 'Ranked #1 Software Engineer in the world according to my parents.', availability: 'Now boarding: backend and platform conversations. Plenty of seats upstairs.', meta: '17+ years · Java · Backend · London' },
      journey: { title: 'Journey', intro: 'Every stop is a chapter. Hop on the bus through my career.', latest: 'Current role' },
      stack: { title: 'Stack', intro: 'The tools I reach for when a system has to keep working after launch.', groups: { core: 'Core', messaging: 'Messaging', cloud: 'Cloud', data: 'Data' } },
      articles: { title: 'Writing', intro: 'Practical engineering notes on Medium.', more: 'All articles', src: 'Medium' },
      repos: { title: 'Code', intro: 'A few public repositories worth a look.', more: 'All repositories', descriptions: {
        'quarkus-fault-tolerance': 'Quarkus fault tolerance example.',
        'quarkus-mongo-crud': 'CRUD example with Quarkus and MongoDB.',
        'kerno-kotlin-challenge': 'Kotlin coding challenge.',
        'neo4j-tech-challenge': 'Java and Neo4j coding challenge.',
        'bookstore-basic-golang': 'Basic bookstore example in Go.',
        'groovy-rest-crud-sample': 'REST CRUD example in Groovy.',
      } },
      recs: { title: 'Recommendations', intro: 'What people I worked with say.' },
      contact: { title: 'Last stop: Wembley', intro: 'Always glad to talk about backend and platform work.', summary: 'From a Computer Science degree to senior backend and platform engineering: 17+ years building software.', email: 'Email', subject: 'Stop requested: let\'s talk', why: 'Or tell me what it is about:', reasons: [{ label: 'Hiring a senior backend engineer', subject: 'Hiring: senior backend engineer' }, { label: 'Backend or platform advice', subject: 'Question about backend or platform work' }, { label: 'Just saying hi', subject: 'Hello from the bus' }], linkedin: 'LinkedIn', github: 'GitHub', cv: 'Download CV' },
    },
    stops: {
      puc: { title: 'PUC-SP', role: 'BSc Computer Science', dates: '2003 – 2008', place: 'São Paulo', body: 'Computer Science degree with a specialisation in software development.' },
      arizona: { title: 'Arizona Premedia', role: 'Java Web Developer', dates: 'May 2011 – Feb 2012', place: 'São Paulo', body: 'Built Arizona.Retail, which creates and lays out tabloids for large Brazilian retailers and sends them to print.' },
      insane: { title: 'Insane Games', role: 'Mobile Application Developer', dates: 'Mar 2012 – Oct 2013', place: 'São Paulo', body: 'Built iOS and Android apps with Appcelerator Titanium and managed them in the stores.' },
      taqtile: { title: 'Taqtile', role: 'Mobile Software Engineer', dates: 'Jan 2014 – Feb 2016', place: 'São Paulo', body: 'Operations team for US clients: fixes, improvements and new features in shipped iOS and Android apps.' },
      mira: { title: 'Mira Educação', role: 'Software Engineer', dates: 'Jan 2017 – Aug 2017', place: 'São Paulo', body: 'Built APIs for the mobile team of a public-education platform. My first microservices with Spring Boot.' },
      reclame: { title: 'Reclame AQUI', role: 'Software Engineer', dates: 'Dec 2017 – Apr 2020', place: 'São Paulo', body: "Backend for Brazil's largest consumer-complaint platform, with automated company rankings." },
      move: { title: 'Moved to London', role: 'Relocation', dates: '2019', place: 'London', body: 'Left São Paulo for London, starting the next chapter of my career.' },
      millimetric: { title: 'Millimetric.ai', role: 'Senior Java Engineer', dates: 'Apr 2020 – Nov 2020', place: 'London', body: 'Arrived in London. Real-time anomaly detection on business metrics with Spring Boot and Cassandra.' },
      xdesign: { title: 'xDesign', role: 'Senior Java Software Engineer', dates: 'Nov 2020 – May 2021', place: 'London', body: "Integrated Onfido document verification into FanDuel's US onboarding flow on AWS." },
      olm: { title: 'OLM Systems — London', role: 'Software Developer III', dates: 'Jul 2021 – Dec 2022', place: 'London', body: 'London phase of CP-IS: secure information sharing that helps health and social care protect vulnerable children. Quarkus, Kafka, Debezium.' },
      glasgow: { title: 'OLM Systems — Glasgow', role: 'Software Developer III', dates: 'Jan 2023 – Feb 2024', place: 'Glasgow', body: 'Moved to Glasgow for the next phase of CP-IS. I lived in Glasgow through 2024, including while working at Tribal from June 2024. Quarkus, Kafka, Debezium.' },
      tribal: { title: 'Tribal Worldwide London', role: 'Senior Software Developer', dates: 'Jun 2024 – Present', place: 'London', body: "Stock archiving, import, export and API services for Volkswagen's vehicle stock data. Spring Boot, MongoDB, ActiveMQ." },
    },
    recs: [
      { name: 'Romeu Ivolela Neto', role: 'Product Manager at UOL', quote: 'Samuel is a committed, serious and extremely responsible professional. Always strive for excellence in your work, improving the project with your technical talent and colleagues with your friendliness and ease of relationship.' },
      { name: 'Decio di Napoli', role: 'Architect at Estudio Arquitetural', quote: 'Samuel is the kind of professional whose knowledge and performance result in extreme quality. Reliable and very serious.' },
    ],
  },
  pt: {
    ui: {
      nav: { journey: 'Trajetória', stack: 'Stack', articles: 'Artigos', repos: 'Código', recs: 'Recomendações', contact: 'Contato' },
      theme: 'Alternar entre dia e noite', auto: 'Passeio automático: o ônibus anda sozinho', sound: 'Som: cidade, clima e trânsito', photo: 'Salvar um cartão-postal desta vista', rideTime: 'Passeio automático ≈ {auto} s · rápido ≈ {quick} s', progressEmpty: 'Comece pela primeira parada · passeio rápido ≈ {quick} s', nextStop: 'Próxima parada', ticketSince: 'desde {year}', ticketStops: '{n} paradas', voice: 'Voz: anunciar cada parada', speak: 'Chegando em {title}. Cuidado com o vão.', svcGood: 'Serviço normal', svcAll: 'Serviço normal em todas as linhas', quickProgress: 'Passeio rápido: {count}/{total} paradas principais', reset: 'Recomeçar o percurso', resetConfirm: 'Apagar seu progresso neste dispositivo?', foundHint: { hide: 'Tecla H esconde o painel.', postcard: 'Salve um cartão-postal desta vista.' }, recap: { title: 'Bilhete do percurso', stops: 'Paradas', cities: 'Cidades', tools: 'Ferramentas vistas', found: 'Achados' }, found: { hide: 'Achado: a cidade sem o painel.', postcard: 'Achado: um cartão-postal para o passaporte.' }, lang: 'Trocar idioma', scroll: 'Role para embarcar', scrollTouch: 'Deslize para embarcar',
      zones: { br: 'Brasil', uk: 'Reino Unido' }, cities: { sp: 'São Paulo', ldn: 'Londres', gla: 'Glasgow' }, arriving: 'Chegando em', quick: 'Passeio rápido: só as paradas principais', hide: 'Esconder a interface e ver a cidade', hideShort: 'Esconder a interface (H)', show: 'Mostrar a interface (H)', passport: 'Passaporte', progress: '{count} de {total} paradas da carreira visitadas', finishComplete: 'Você visitou todas as {total} paradas da carreira. Obrigado pela viagem.', finishContinue: 'Você visitou {count} de {total} paradas da carreira. O percurso completo está em Trajetória.', credits: { link: 'Créditos e como foi feito', title: 'Créditos', intro: 'Modelos 3D de terceiros, usados sob suas licenças e convertidos, unidos e comprimidos para a web.', built: 'Como foi feito', items: ['HTML, CSS e módulos ES puros: sem etapa de build e sem framework.', 'O Three.js desenha a cidade: prédios instanciados, marcos autorais e qualidade adaptativa.', 'Testes automatizados rodam a cada push.', 'Os ônibus, prédios e marcos são trabalho original; as pessoas usam malhas-base CC0.'], close: 'Fechar' }, usedAt: 'Usado em', clearFilter: 'Mostrar todas as paradas', led: { gap: 'Atenção ao vão', rain: 'Atraso: chuva', end: 'Fim de linha', stop: 'Parada pedida', horn: 'Pi pi', final: 'Fim de linha. Obrigado pela viagem', count: 'Paradas {count}/{total}', found: 'Achado encontrado' }, clock: 'Agora em Londres', loading: 'Esquentando o ônibus…', intro: { owner: 'Samuel Catalano', ticket: 'Bilhete de viagem', ticketNumber: 'Bilhete nº 0083', passenger: 'Passageiro: você', stages: { vehicles: 'Trânsito', landmarks: 'Marcos', npc: 'Pessoas', buildings: 'Prédios', vegetation: 'Árvores', city: 'Cidade' }, ready: 'Todos a bordo', start: 'Começar a viagem', loadingBtn: 'Preparando sua viagem', finishing: 'Preparando a partida', loaded: 'Tudo pronto para partir.', greet: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' }, title: 'Próxima parada: a trajetória', sub: 'Engenheiro sênior de backend e plataforma, 17+ anos: de São Paulo ao Reino Unido.', hint: 'Role para explorar · {→} avança · {←} volta', t_hint: 'Deslize para dirigir', skip: 'Pular', d1: 'São Paulo', d2: 'Londres', d3: 'Glasgow' }, navLabel: 'Seções', beforeLondon: 'Antes de Londres', present: 'Atual', skip: 'Pular para o conteúdo', footer: 'Projetado e construído por Samuel Catalano.',
      signpost: { saoPaulo: 'São Paulo', london: 'Londres', km: '9.480 km' },
    },
    sections: {
      hero: { title: 'Samuel Catalano', kicker: 'Engenharia backend e plataforma', role: 'Engenheiro de Software Sênior', value: 'Engenheiro backend para sistemas que continuam funcionando depois do lançamento.', proof: 'Samuel é um profissional comprometido, sério e extremamente responsável.', tagline: 'Engenheiro de software nº 1 do mundo, segundo meus pais.', availability: 'Embarque aberto: conversas sobre backend e plataforma. Ainda tem lugar no andar de cima.', meta: '17+ anos · Java · Backend · Londres' },
      journey: { title: 'Trajetória', intro: 'Cada parada, um capítulo. Embarque no ônibus pela minha carreira.', latest: 'Cargo atual' },
      stack: { title: 'Stack', intro: 'As ferramentas que uso quando um sistema precisa continuar funcionando depois do lançamento.', groups: { core: 'Base', messaging: 'Mensageria', cloud: 'Nuvem', data: 'Dados' } },
      articles: { title: 'Artigos', intro: 'Notas práticas de engenharia no Medium.', more: 'Todos os artigos', src: 'Medium' },
      repos: { title: 'Código', intro: 'Alguns repositórios públicos que valem a visita.', more: 'Todos os repositórios', descriptions: {
        'quarkus-fault-tolerance': 'Exemplo de tolerância a falhas com Quarkus.',
        'quarkus-mongo-crud': 'Exemplo de CRUD com Quarkus e MongoDB.',
        'kerno-kotlin-challenge': 'Desafio de programação em Kotlin.',
        'neo4j-tech-challenge': 'Desafio de programação com Java e Neo4j.',
        'bookstore-basic-golang': 'Exemplo básico de livraria em Go.',
        'groovy-rest-crud-sample': 'Exemplo de CRUD REST em Groovy.',
      } },
      recs: { title: 'Recomendações', intro: 'O que dizem pessoas que trabalharam comigo.' },
      contact: { title: 'Última parada: Wembley', intro: 'Sempre feliz em conversar sobre backend e plataforma.', summary: 'Da graduação em Ciência da Computação à engenharia backend e de plataforma sênior: mais de 17 anos construindo software.', email: 'E-mail', subject: 'Parada solicitada: vamos conversar', why: 'Ou me diga do que se trata:', reasons: [{ label: 'Contratar um backend sênior', subject: 'Vaga: engenheiro backend sênior' }, { label: 'Conselho sobre backend ou plataforma', subject: 'Pergunta sobre backend ou plataforma' }, { label: 'Só dizer oi', subject: 'Um oi do ônibus' }], linkedin: 'LinkedIn', github: 'GitHub', cv: 'Baixar CV' },
    },
    stops: {
      puc: { title: 'PUC-SP', role: 'Bacharelado em Ciência da Computação', dates: '2003 – 2008', place: 'São Paulo', body: 'Ciência da Computação com especialização em desenvolvimento de software.' },
      arizona: { title: 'Arizona Premedia', role: 'Desenvolvedor Java Web', dates: 'mai 2011 – fev 2012', place: 'São Paulo', body: 'Construí o Arizona.Retail, que cria e diagrama tabloides para grandes varejistas e envia para a gráfica.' },
      insane: { title: 'Insane Games', role: 'Desenvolvedor Mobile', dates: 'mar 2012 – out 2013', place: 'São Paulo', body: 'Apps iOS e Android com Appcelerator Titanium, publicados e mantidos nas lojas.' },
      taqtile: { title: 'Taqtile', role: 'Engenheiro de Software Mobile', dates: 'jan 2014 – fev 2016', place: 'São Paulo', body: 'Time de operações para clientes dos EUA: correções, melhorias e novas funcionalidades em apps iOS e Android já publicados.' },
      mira: { title: 'Mira Educação', role: 'Engenheiro de Software', dates: 'jan 2017 – ago 2017', place: 'São Paulo', body: 'APIs para o time mobile de uma plataforma de educação pública. Meus primeiros microsserviços com Spring Boot.' },
      reclame: { title: 'Reclame AQUI', role: 'Engenheiro de Software', dates: 'dez 2017 – abr 2020', place: 'São Paulo', body: 'Backend da maior plataforma de reclamações do Brasil, com rankings automáticos de empresas.' },
      move: { title: 'Mudança para Londres', role: 'Mudança', dates: '2019', place: 'Londres', body: 'Deixei São Paulo rumo a Londres, começando o próximo capítulo da minha carreira.' },
      millimetric: { title: 'Millimetric.ai', role: 'Engenheiro Java Sênior', dates: 'abr 2020 – nov 2020', place: 'Londres', body: 'Cheguei a Londres. Detecção de anomalias em métricas de negócio em tempo real com Spring Boot e Cassandra.' },
      xdesign: { title: 'xDesign', role: 'Engenheiro de Software Java Sênior', dates: 'nov 2020 – mai 2021', place: 'Londres', body: 'Integração da verificação de documentos Onfido no onboarding da FanDuel nos EUA, na AWS.' },
      olm: { title: 'OLM Systems — Londres', role: 'Desenvolvedor de Software III', dates: 'jul 2021 – dez 2022', place: 'Londres', body: 'Fase londrina do CP-IS: compartilhamento seguro de informações para a saúde e assistência social protegerem crianças vulneráveis. Quarkus, Kafka, Debezium.' },
      glasgow: { title: 'OLM Systems — Glasgow', role: 'Desenvolvedor de Software III', dates: 'jan 2023 – fev 2024', place: 'Glasgow', body: 'Mudei para Glasgow em 2023 para a próxima fase do CP-IS e morei em Glasgow até o fim de 2024, inclusive enquanto trabalhava na Tribal a partir de junho de 2024. Quarkus, Kafka, Debezium.' },
      tribal: { title: 'Tribal Worldwide London', role: 'Desenvolvedor de Software Sênior', dates: 'jun 2024 – atual', place: 'Londres', body: 'Serviços de arquivamento, importação, exportação e API para o estoque de veículos da Volkswagen. Spring Boot, MongoDB, ActiveMQ.' },
    },
    recs: [
      { name: 'Romeu Ivolela Neto', role: 'Product Manager na UOL', quote: 'Samuel é um profissional comprometido, sério e extremamente responsável. Sempre busca a excelência em seu trabalho, melhorando o projeto com seu talento técnico e os colegas com sua simpatia e facilidade de relacionamento.' },
      { name: 'Decio di Napoli', role: 'Arquiteto no Estudio Arquitetural', quote: 'Samuel é o tipo de profissional cujo conhecimento e desempenho resultam em qualidade extrema. Confiável e muito sério.' },
    ],
  },
};

// Which journey stops mention each tool, derived from the English stop copy so it never drifts from the text. Tools the copy never names stay unlinked.
const TOOL_KEY = { 'Java 17': 'Java', 'JUnit · Mockito': null, 'SNS/SQS': null, 'AWS Lambda': null };
export const toolStops = Object.fromEntries(stack.map((tool) => {
  const key = tool in TOOL_KEY ? TOOL_KEY[tool] : tool;
  const re = key && new RegExp(`\\b${key}\\b`, 'i');
  return [tool, re ? stops.filter(st => st.section === 'journey' && re.test(`${i18n.en.stops[st.id].role} ${i18n.en.stops[st.id].body}`)).map(st => st.id) : []];
}));

// The ticket a tool shows in the stack: its first year and how many journey stops mention it; null when the copy never names it.
export const toolSpan = (tool) => {
  const ids = toolStops[tool] || [];
  return ids.length ? { since: Math.min(...ids.map(id => +stops.find(st => st.id === id).year)), count: ids.length } : null;
};
// city of a stop: drives the accent colour, the ticket stamp and the arrival banner
export const cityOf = (st) => (st.country === 'BR' ? 'sp' : st.id === 'glasgow' ? 'gla' : 'ldn');
// the quick tour: one stop per chapter of the career
export const QUICK = ['puc', 'mira', 'move', 'xdesign', 'glasgow', 'contact'];
