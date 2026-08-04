/**
 * Formatiert einen Personennamen bereits waehrend der Eingabe: Der erste Buchstabe
 * jedes Namensteils wird gross geschrieben, alle folgenden Buchstaben klein.
 * Trennzeichen sind Leerzeichen, Bindestrich und Apostroph.
 *
 * "ilayda utkuel"  -> "Ilayda Utkuel"
 * "ILAYDA UTKUEL"  -> "Ilayda Utkuel"
 * "anna-maria"     -> "Anna-Maria"
 *
 * Die Zeichenlaenge bleibt unveraendert, damit die Cursorposition im Eingabefeld
 * erhalten bleibt.
 */
const NAME_SEPARATORS = new Set([" ", "-", "'", "’"]);

export function formatPersonName(value: string): string {
  let result = "";
  let startOfWord = true;
  for (const char of value) {
    if (NAME_SEPARATORS.has(char)) {
      result += char;
      startOfWord = true;
      continue;
    }
    result += startOfWord ? char.toLocaleUpperCase("de-DE") : char.toLocaleLowerCase("de-DE");
    startOfWord = false;
  }
  return result;
}
