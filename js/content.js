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
  { id: 'millimetric', section: 'journey', year: '2020', country: 'UK', brand: { initials: 'MM', color: '#2b59c3' } },
  { id: 'xdesign', section: 'journey', year: '2020', country: 'UK', brand: { initials: 'XD', color: '#be123c' } },
  { id: 'olm', section: 'journey', year: '2021', country: 'UK', brand: { initials: 'OLM', color: '#0f766e' } },
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
};

export const articles = [
  { title: 'Mastering the Art of Backend Hiring', url: 'https://medium.com/thefreshwrites/mastering-the-art-of-backend-hiring-essential-questions-for-interviewers-and-candidates-e0deb436f8ff' },
  { title: 'Quarkus and the MicroProfile Fault Tolerance API', url: 'https://medium.com/thefreshwrites/quarkus-and-a-microprofile-fault-tolerance-api-fee82de09616' },
  { title: 'Mapping Entities to DTOs and vice versa in Java', url: 'https://medium.com/thefreshwrites/mapping-entities-to-dtos-and-vice-versa-in-java-fe126f6bb6b2' },
];

export const repos = [
  { name: 'quarkus-fault-tolerance', lang: 'Java · Quarkus' },
  { name: 'quarkus-mongo-crud', lang: 'Java · Quarkus · MongoDB' },
  { name: 'kerno-kotlin-challenge', lang: 'Kotlin' },
  { name: 'neo4j-tech-challenge', lang: 'Java · Neo4j' },
  { name: 'bookstore-basic-golang', lang: 'Go' },
  { name: 'groovy-rest-crud-sample', lang: 'Groovy' },
].map(r => ({ ...r, url: `https://github.com/samuelcatalano/${r.name}` }));

export const stack = ['Java 17', 'Spring Boot', 'Quarkus', 'Kafka', 'Debezium', 'AWS Lambda', 'SNS/SQS',
  'Docker', 'Kubernetes', 'PostgreSQL', 'MySQL', 'MongoDB', 'Cassandra', 'ActiveMQ', 'Terraform', 'JUnit · Mockito'];

export const i18n = {
  en: {
    ui: {
      nav: { journey: 'Journey', stack: 'Stack', articles: 'Writing', repos: 'Code', contact: 'Contact' },
      theme: 'Switch between day and night', lang: 'Switch language', scroll: 'Scroll to ride',
      beforeLondon: 'Before London', present: 'Present', skip: 'Skip to content', footer: 'Designed and built by Samuel Catalano.',
    },
    sections: {
      hero: { title: 'Samuel Catalano', role: 'Senior Software Engineer', tagline: 'Ranked #1 Software Engineer in the world according to my parents.', meta: '17+ years · Java · Backend · London' },
      journey: { title: 'Journey', intro: 'Every stop is a chapter. Hop on the bus through my career.' },
      stack: { title: 'Stack', intro: 'The tools I reach for when a system has to keep working after launch.' },
      articles: { title: 'Writing', intro: 'Practical engineering notes on Medium.', more: 'All articles' },
      repos: { title: 'Code', intro: 'A few public repositories worth a look.', more: 'All repositories' },
      recs: { title: 'Kind words', intro: 'What people I worked with say.' },
      contact: { title: 'Last stop: Wembley', intro: 'Always glad to talk about backend and platform work.', email: 'Email', linkedin: 'LinkedIn', github: 'GitHub' },
    },
    stops: {
      puc: { title: 'PUC-SP', role: 'BSc Computer Science', dates: '2003 – 2008', place: 'São Paulo', body: 'Computer Science degree with a specialisation in software development.' },
      arizona: { title: 'Arizona Premedia', role: 'Java Web Developer', dates: 'May 2011 – Feb 2012', place: 'São Paulo', body: 'Built Arizona.Retail, which creates and lays out tabloids for large Brazilian retailers and sends them to print.' },
      insane: { title: 'Insane Games', role: 'Mobile Application Developer', dates: 'Mar 2012 – Oct 2013', place: 'São Paulo', body: 'Built iOS and Android apps with Appcelerator Titanium and managed them in the stores.' },
      taqtile: { title: 'Taqtile', role: 'Mobile Software Engineer', dates: 'Jan 2014 – Feb 2016', place: 'São Paulo', body: 'Operations team for US clients: fixes, improvements and new features in shipped iOS and Android apps.' },
      mira: { title: 'Mira Educação', role: 'Software Engineer', dates: 'Jan 2017 – Aug 2017', place: 'São Paulo', body: 'Built APIs for the mobile team of a public-education platform. My first microservices with Spring Boot.' },
      reclame: { title: 'Reclame AQUI', role: 'Software Engineer', dates: 'Dec 2017 – Apr 2020', place: 'São Paulo', body: "Backend for Brazil's largest consumer-complaint platform, with automated company rankings." },
      millimetric: { title: 'Millimetric.ai', role: 'Senior Java Engineer', dates: 'Apr 2020 – Nov 2020', place: 'London', body: 'Arrived in London. Real-time anomaly detection on business metrics with Spring Boot and Cassandra.' },
      xdesign: { title: 'xDesign', role: 'Senior Java Software Engineer', dates: 'Nov 2020 – May 2021', place: 'London', body: "Integrated Onfido document verification into FanDuel's US onboarding flow on AWS." },
      olm: { title: 'OLM Systems', role: 'Software Developer III', dates: 'Jul 2021 – Feb 2024', place: 'London / Glasgow', body: 'CP-IS: secure information sharing that helps health and social care protect vulnerable children. Quarkus, Kafka, Debezium.' },
      tribal: { title: 'Tribal Worldwide London', role: 'Senior Software Developer', dates: 'Jun 2024 – Present', place: 'London', body: "Stock archiving, import, export and API services for Volkswagen's vehicle stock data. Spring Boot, MongoDB, ActiveMQ." },
    },
    recs: [
      { name: 'Romeu Ivolela Neto', role: 'Product Manager at UOL', quote: 'Samuel is a committed, serious and extremely responsible professional. Always strive for excellence in your work, improving the project with your technical talent and colleagues with your friendliness and ease of relationship.' },
      { name: 'Decio di Napoli', role: 'Architect at Estudio Arquitetural', quote: 'Samuel is the kind of professional whose knowledge and performance result in extreme quality. Reliable and very serious.' },
    ],
  },
  pt: {
    ui: {
      nav: { journey: 'Trajetória', stack: 'Stack', articles: 'Artigos', repos: 'Código', contact: 'Contato' },
      theme: 'Alternar entre dia e noite', lang: 'Trocar idioma', scroll: 'Role para embarcar',
      beforeLondon: 'Antes de Londres', present: 'Atual', skip: 'Pular para o conteúdo', footer: 'Projetado e construído por Samuel Catalano.',
    },
    sections: {
      hero: { title: 'Samuel Catalano', role: 'Engenheiro de Software Sênior', tagline: 'Engenheiro de software nº 1 do mundo, segundo meus pais.', meta: '17+ anos · Java · Backend · Londres' },
      journey: { title: 'Trajetória', intro: 'Cada parada, um capítulo. Embarque no ônibus pela minha carreira.' },
      stack: { title: 'Stack', intro: 'As ferramentas que uso quando um sistema precisa continuar funcionando depois do lançamento.' },
      articles: { title: 'Artigos', intro: 'Notas práticas de engenharia no Medium.', more: 'Todos os artigos' },
      repos: { title: 'Código', intro: 'Alguns repositórios públicos que valem a visita.', more: 'Todos os repositórios' },
      recs: { title: 'Recomendações', intro: 'O que dizem pessoas que trabalharam comigo.' },
      contact: { title: 'Última parada: Wembley', intro: 'Sempre feliz em conversar sobre backend e plataforma.', email: 'E-mail', linkedin: 'LinkedIn', github: 'GitHub' },
    },
    stops: {
      puc: { title: 'PUC-SP', role: 'Bacharelado em Ciência da Computação', dates: '2003 – 2008', place: 'São Paulo', body: 'Ciência da Computação com especialização em desenvolvimento de software.' },
      arizona: { title: 'Arizona Premedia', role: 'Desenvolvedor Java Web', dates: 'mai 2011 – fev 2012', place: 'São Paulo', body: 'Construí o Arizona.Retail, que cria e diagrama tabloides para grandes varejistas e envia para a gráfica.' },
      insane: { title: 'Insane Games', role: 'Desenvolvedor Mobile', dates: 'mar 2012 – out 2013', place: 'São Paulo', body: 'Apps iOS e Android com Appcelerator Titanium, publicados e mantidos nas lojas.' },
      taqtile: { title: 'Taqtile', role: 'Engenheiro de Software Mobile', dates: 'jan 2014 – fev 2016', place: 'São Paulo', body: 'Time de operações para clientes dos EUA: correções, melhorias e novas funcionalidades em apps iOS e Android já publicados.' },
      mira: { title: 'Mira Educação', role: 'Engenheiro de Software', dates: 'jan 2017 – ago 2017', place: 'São Paulo', body: 'APIs para o time mobile de uma plataforma de educação pública. Meus primeiros microsserviços com Spring Boot.' },
      reclame: { title: 'Reclame AQUI', role: 'Engenheiro de Software', dates: 'dez 2017 – abr 2020', place: 'São Paulo', body: 'Backend da maior plataforma de reclamações do Brasil, com rankings automáticos de empresas.' },
      millimetric: { title: 'Millimetric.ai', role: 'Engenheiro Java Sênior', dates: 'abr 2020 – nov 2020', place: 'Londres', body: 'Cheguei a Londres. Detecção de anomalias em métricas de negócio em tempo real com Spring Boot e Cassandra.' },
      xdesign: { title: 'xDesign', role: 'Engenheiro de Software Java Sênior', dates: 'nov 2020 – mai 2021', place: 'Londres', body: 'Integração da verificação de documentos Onfido no onboarding da FanDuel nos EUA, na AWS.' },
      olm: { title: 'OLM Systems', role: 'Desenvolvedor de Software III', dates: 'jul 2021 – fev 2024', place: 'Londres / Glasgow', body: 'CP-IS: compartilhamento seguro de informações para a saúde e assistência social protegerem crianças vulneráveis. Quarkus, Kafka, Debezium.' },
      tribal: { title: 'Tribal Worldwide London', role: 'Desenvolvedor de Software Sênior', dates: 'jun 2024 – atual', place: 'Londres', body: 'Serviços de arquivamento, importação, exportação e API para o estoque de veículos da Volkswagen. Spring Boot, MongoDB, ActiveMQ.' },
    },
    recs: [
      { name: 'Romeu Ivolela Neto', role: 'Product Manager na UOL', quote: 'Samuel é um profissional comprometido, sério e extremamente responsável. Sempre busca a excelência em seu trabalho, melhorando o projeto com seu talento técnico e os colegas com sua simpatia e facilidade de relacionamento.' },
      { name: 'Decio di Napoli', role: 'Arquiteto no Estudio Arquitetural', quote: 'Samuel é o tipo de profissional cujo conhecimento e desempenho resultam em qualidade extrema. Confiável e muito sério.' },
    ],
  },
};
