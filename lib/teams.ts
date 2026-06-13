const TEAM_MAP: Record<string, string> = {
  Algeria: 'Argélia',
  Argentina: 'Argentina',
  Australia: 'Austrália',
  Austria: 'Áustria',
  Belgium: 'Bélgica',
  'Bosnia-Herzegovina': 'Bósnia-Herzegovina',
  Brazil: 'Brasil',
  Canada: 'Canadá',
  'Cape Verde Islands': 'Cabo Verde',
  Colombia: 'Colômbia',
  'Congo DR': 'RD Congo',
  Croatia: 'Croácia',
  Curaçao: 'Curaçao',
  Czechia: 'Tchéquia',
  Ecuador: 'Equador',
  Egypt: 'Egito',
  England: 'Inglaterra',
  France: 'França',
  Germany: 'Alemanha',
  Ghana: 'Gana',
  Haiti: 'Haiti',
  Iran: 'Irã',
  Iraq: 'Iraque',
  'Ivory Coast': 'Costa do Marfim',
  Japan: 'Japão',
  Jordan: 'Jordânia',
  Mexico: 'México',
  Morocco: 'Marrocos',
  Netherlands: 'Holanda',
  'New Zealand': 'Nova Zelândia',
  Norway: 'Noruega',
  Panama: 'Panamá',
  Paraguay: 'Paraguai',
  Portugal: 'Portugal',
  Qatar: 'Catar',
  'Saudi Arabia': 'Arábia Saudita',
  Scotland: 'Escócia',
  Senegal: 'Senegal',
  'South Africa': 'África do Sul',
  'South Korea': 'Coreia do Sul',
  Spain: 'Espanha',
  Sweden: 'Suécia',
  Switzerland: 'Suíça',
  Tunisia: 'Tunísia',
  Turkey: 'Turquia',
  'United States': 'Estados Unidos',
  Uruguay: 'Uruguai',
  Uzbekistan: 'Uzbequistão',
};

const TEAM_NAME_NORMALIZE: Record<string, string> = {
  'Czech Republic': 'Czechia',
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'Cape Verde': 'Cape Verde Islands',
  'Democratic Republic of the Congo': 'Congo DR',
};

export function translateTeam(name: string): string {
  return TEAM_MAP[name] || name;
}

export function normalizeTeam(name: string): string {
  return TEAM_NAME_NORMALIZE[name] || name;
}
