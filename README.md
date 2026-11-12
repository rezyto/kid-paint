# 🎨 Pinta Comigo

Um caderno de colorir para crianças, para tablets Android. Pinta-se com o dedo.

- **Desenhos infinitos**, gerados pela própria app: animais, natureza, casas e veículos, mandalas, padrões, letras (A de Avião…) e números (contar 1 a 12).
- **Três níveis** (🐣 Fácil, 🐥 Médio, 🦉 Difícil). Os desenhos ficam mais detalhados à medida que a criança cresce.
- **Fotos**: tira uma foto ou escolhe uma da galeria e ela passa a desenho a preto e branco para pintar.
- **Ferramentas**: balde (enche os espaços), caneta, lápis, cera, pincel, arco-íris, carimbos e borracha. Há também ↩️ desfazer, ↪️ refazer, 🗑️ apagar tudo, três grossuras, 24 cores e uma cor à escolha.
- **Guarda sozinha** enquanto se pinta e ao sair, e reabre exatamente onde estava.
- **Os meus desenhos**: uma galeria com tudo o que já pintou, que dá para continuar, guardar na galeria do tablet ou apagar.
- **Atualizações automáticas**: a app avisa quando há uma versão nova, e os desenhos nunca se perdem.
- Grátis, sem anúncios, sem compras e sem contas. Funciona sem internet.
- **Folha em branco** para desenho livre, **conta-gotas**, **cores recentes**, 5 grossuras e zoom (dois dedos ou botões).
- **Galeria** com filtros (A pintar, Concluídos, Favoritos), ❤ favoritos, "Pintar outra vez", partilhar e guardar na galeria do tablet.
- **Cópia de segurança**: exporta todos os desenhos para um ficheiro e restaura noutro aparelho.
- Adapta-se a qualquer ecrã (telemóvel, tablet, vertical ou horizontal). Tem modo canhoto, sons, vibração e ecrã sempre ligado enquanto pinta.
- Os pais entram nas definições mantendo o botão **Pais** carregado.

## Instalar no tablet

1. No tablet, abre **[Releases](../../releases/latest)** e toca em **PintaComigo.apk**.
2. Toca em **Instalar**. Se o Android pedir, permite "instalar apps desta origem".

## Como funciona

- `web/`: a app em si (HTML, CSS e JavaScript, sem bibliotecas externas).
  - `gen.js`: gerador de páginas para colorir (cada página vem de uma semente, por isso nunca acabam).
  - `photo.js`: converte uma foto em linhas.
  - `db.js`: guarda os desenhos no tablet (IndexedDB).
  - `app.js`: ecrãs, ferramentas, balde, desfazer, gravação automática.
- `app/`: a "casca" Android (WebView), mais as fotos, o guardar na galeria e as atualizações.
- `.github/workflows/build.yml`: cada alteração em `main` gera um APK novo e publica-o em *Releases*. As apps instaladas encontram-no aí.

Para experimentar no computador: `cd web && python3 -m http.server` e abre http://localhost:8000.

> Nota: o repositório tem de ficar **público**, porque é daqui que a app instalada vai buscar as atualizações sem precisar de contas. A chave de assinatura (`app/pintacomigo.keystore`) está no repositório para tudo funcionar sem configurar nada. A app só aceita atualizações publicadas *neste* repositório, que só tu controlas.
