/**
 * Da um identificador estavel para o ciclo do scheduler ao qual um instante
 * pertence, agrupando o dia em janelas de cycleMinutes.
 *
 * O timezone e fixado em America/Sao_Paulo (em vez de usar o timezone do
 * runtime) porque o cycleId precisa ser o mesmo independente de onde o
 * processo estiver rodando - caso contrario, o mesmo horario real geraria
 * cycleIds diferentes em maquinas com timezones diferentes, quebrando o
 * lock de deduplicacao de ciclos que depende desse ID ser deterministico.
 *
 * @param now          - instante atual (Date)
 * @param cycleMinutes - duracao do ciclo em minutos (default 180)
 * @returns cycleId no formato "cycle-{YYYY}-{MM}-{DD}-{bucket}", ex:
 *   02:59 e 00:00 caem no bucket 0; 03:00 ja cai no bucket 1 (cycleMinutes=180)
 */
export function buildCycleWindowId(now: Date, cycleMinutes: number = 180): string {
  // Formatar a data/hora no timezone correto usando Intl
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;

  const year = get('year');
  const month = get('month');
  const day = get('day');
  // hour12:false por si so nao fixa o cycle 0-23: dependendo da implementacao
  // ICU do runtime, o par {hour12:false} sem hourCycle explicito pode resolver
  // para "h24" (1-24) em vez de "h23" (0-23), fazendo meia-noite ser formatada
  // como "24" ao inves de "00". Sem essa normalizacao, buildCycleWindowId
  // calcularia totalMinutes=1440 para meia-noite e cairia no bucket seguinte
  // em vez do bucket 0 do dia certo.
  const rawHour = parseInt(get('hour'), 10);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = parseInt(get('minute'), 10);

  const totalMinutes = hour * 60 + minute;
  const bucket = Math.floor(totalMinutes / cycleMinutes);

  return `cycle-${year}-${month}-${day}-${bucket}`;
}
