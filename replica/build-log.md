# Build log
- Shell: 6 ecrãs (S01–S06) numa página, navegação com botão voltar do Android.
- Vertical slice: catálogo → página → balde → gravação → retomar. Testado com Playwright (1280×800 e 800×1280).
- S01 Início: mosaicos, cartão "continuar".
- S02 Catálogo: miniaturas geradas de forma preguiçosa, scroll infinito, níveis.
- S03 Pintar: 8 ferramentas, 3 grossuras, 24 cores + livre, desfazer/refazer, apagar tudo, zoom com 2 dedos, gravação automática, "Terminei" com confetes.
- S04 Galeria: vazio/cheio, guardar no tablet, apagar com confirmação.
- S05 Foto: câmara/galeria, detalhe e espessura, erro de ficheiro.
- S06 Pais: nível, sons, contagem, atualizações, versão (porta: manter carregado).
- Android: WebView com asset loader (origem estável → dados persistem), escolha de fotos, guardar na galeria, atualizador por GitHub Releases, ecrã inteiro.
