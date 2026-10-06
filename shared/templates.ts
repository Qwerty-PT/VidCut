// Registo dos modelos (pasta modelos/, índice gerado automaticamente)
import { TEMPLATES } from '../modelos';
import type { TemplateDef } from './template-api';

export { TEMPLATES };
export const getTemplate = (id: string): TemplateDef | undefined => TEMPLATES.find((t) => t.id === id);
