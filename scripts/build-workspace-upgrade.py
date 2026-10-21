"""Assemble rerunnable additive installers from their maintained sources."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
files=['forma-crm.sql','forma-finance-periods.sql','forma-cash.sql','forma-monthly.sql','forma-statement.sql','forma-education.sql']
def body(name):
 s=(root/name).read_text();s=re.sub(r'^begin;\s*$|^commit;\s*$|^select to_regprocedure\([^\n]*;\s*$','',s,flags=re.M);return s
workspace='-- FORMA: activación atómica y aditiva; conserva registros existentes.\nbegin;\n'+'\n'.join(map(body,files))+"\ncommit;\nselect true as forma_actualizada;\n"
(root/'forma-workspace-upgrade.sql').write_text(workspace)
(root/'forma-education-upgrade.sql').write_text('-- FORMA: activar matrículas después de la agenda de servicios.\nbegin;\n'+body('forma-finance.sql')+'\n'+re.sub(r'^begin;\s*$|^commit;\s*$|^select true as forma_actualizada;\s*$','',workspace,flags=re.M)+'\ncommit;\nselect true as matriculas_activadas;\n')
