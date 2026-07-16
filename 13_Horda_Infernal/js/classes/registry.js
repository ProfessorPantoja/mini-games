/**
 * Registry de classes — ponto único de cadastro.
 *
 * Para adicionar uma classe nova:
 *  1. Crie js/classes/<id>.js (copie archer.js como molde)
 *  2. Importe e registre em CLASSES abaixo
 *  3. Pronto — seletor, stats e estilo de combate leem daqui
 *
 * NÃO coloque lógica de classe em game.js. Mantenha arquivos ~80–150 linhas
 * para agentes/humanos abrirem só o que importa (economia de tokens).
 */

import barbarian from "./barbarian.js";
import archer from "./archer.js";
import mage from "./mage.js";
import monk from "./monk.js";

/** @type {Record<string, import('./barbarian.js').default>} */
export const CLASSES = {
  barbarian,
  archer,
  mage,
  monk,
};

/** Ordem de exibição no seletor */
export const CLASS_ORDER = ["barbarian", "archer", "mage", "monk"];

export function getClass(id) {
  return CLASSES[id] || CLASSES.barbarian;
}

export function listClasses() {
  return CLASS_ORDER.map((id) => CLASSES[id]);
}

export function listUnlockedClasses() {
  return listClasses().filter((c) => c.unlocked);
}
