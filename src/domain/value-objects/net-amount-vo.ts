/**
 * Subtrai a taxa cobrada pela Stark Bank do valor bruto da invoice.
 *
 * O retorno null (em vez de zero ou negativo) e proposital: quando a taxa
 * consome o valor todo, nao ha nada a transferir, e quem chama esta funcao
 * usa esse null como sinal explicito para pular a criacao do transfer em
 * vez de tentar enviar um valor invalido para a Stark Bank.
 *
 * @param amount - valor total em centavos
 * @param fee    - taxa em centavos
 * @returns      netAmount em centavos, ou null se a taxa >= valor
 */
export function calculateNetAmount(amount: number, fee: number): number | null {
  if (fee >= amount) return null;
  return amount - fee;
}
