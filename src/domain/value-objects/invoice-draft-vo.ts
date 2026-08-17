export interface InvoiceDraft {
  amount: number; // centavos, entre 1000 e 50000
  name: string;
  taxId: string; // CPF valido formatado: XXX.XXX.XXX-XX
}

/**
 * Gera um CPF que passa na validacao de digito verificador, para preencher
 * o taxId das invoices de teste do desafio.
 *
 * A Stark Bank (como qualquer sistema que integra com CPF) rejeita taxIds
 * com digitos verificadores incorretos, entao nao da pra so sortear 11
 * digitos aleatorios: os dois ultimos precisam ser calculados a partir dos
 * 9 primeiros usando o modulo 11, que e o algoritmo oficial da Receita
 * Federal para esse check digit. O loop que gera os 9 digitos base evita
 * sequencias repetidas (111.111.111 etc.), que sao formalmente validas no
 * modulo 11 mas rejeitadas por qualquer validador de CPF real por serem
 * numeros de teste/invalidos conhecidos.
 *
 * Math.random() e apropriado aqui: o CPF gerado e dado sintetico de teste
 * para o destinatario da invoice (o proprio desafio pede "pessoas
 * aleatorias"), nunca usado como segredo, credencial ou identificador de
 * seguranca - um PRNG nao-criptografico nao enfraquece nada.
 */
export function generateCpf(): string {
  // 9 digitos base do CPF. O re-sorteio abaixo existe porque uma sequencia
  // com todos os digitos iguais (111.111.111 etc.) passa no modulo 11 mas
  // e conhecida por ser rejeitada por validadores de CPF reais.
  let digits: number[];
  do {
    digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  } while (digits.every((d) => d === digits[0]));

  // 1o digito verificador: peso decrescente de 10 a 2 sobre os 9 digitos base
  let sum = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;

  // 2o digito verificador: mesma logica, mas com peso 11 a 2 e incluindo o d1 ja calculado
  sum = digits.reduce((acc, d, i) => acc + d * (11 - i), 0) + d1 * 2;
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;

  const all = [...digits, d1, d2];
  return `${all.slice(0, 3).join('')}.${all.slice(3, 6).join('')}.${all.slice(6, 9).join('')}-${all.slice(9).join('')}`;
}

/** Lista de nomes ficticios para geracao aleatoria de invoices */
const NAMES = [
  'Rafaela Nunes', 'Gustavo Teixeira', 'Camila Barbosa', 'Vinicius Moraes',
  'Patricia Gomes', 'Eduardo Souza', 'Larissa Cardoso', 'Marcos Ferreira',
  'Beatriz Lima', 'Thiago Martins', 'Juliana Rodrigues', 'Felipe Andrade',
  'Daniela Nascimento', 'Ricardo Alves', 'Mariana Pereira', 'Bruno Araujo',
  'Fernanda Santos', 'Carlos Oliveira',
];

/**
 * Gera um rascunho de invoice com dados aleatorios.
 * Amount: entre 1000 e 50000 centavos (R$10 a R$500).
 */
export function generateInvoiceDraft(): InvoiceDraft {
  // amount/name sorteados aqui sao dado de teste sintetico (mesmo raciocinio
  // de generateCpf acima) - nao ha uso criptografico ou de seguranca.
  return {
    amount: Math.floor(Math.random() * (50000 - 1000 + 1)) + 1000,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    taxId: generateCpf(),
  };
}
