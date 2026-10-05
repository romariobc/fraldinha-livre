-- Somente banco exclusivo da homologação, validado pelo deploy-homologation.mjs.
UPDATE products SET active = 0;
INSERT INTO products (id, price_cents, supplier_id, name, brand, size, quantity, slug, categoria, descricao, atributos, active)
VALUES
('c472ea87-3d21-4ccd-8b98-3bb1ee58dbb9', 2490, 'cSK4LXIakuajmCSiJFaHOccck2s1', 'Supersec Pants', 'Pampers', 'P', 100, 'qa-pampers-supersec-pants-p', 'fraldas-descartaveis', 'Pacote de fraldas Pampers tamanho P com 36 tiras.', '{}', 1),
('b55fb7ac-73dc-4636-a21e-7786ac56d017', 2990, 'cSK4LXIakuajmCSiJFaHOccck2s1', 'Confort Sec', 'Pampers', 'M', 100, 'qa-pampers-confort-sec-m', 'fraldas-descartaveis', 'Pacote de fraldas Pampers tamanho M com 40 tiras.', '{}', 1),
('b0f78fa5-8e52-4469-bf0f-3ee67a930297', 1990, 'cSK4LXIakuajmCSiJFaHOccck2s1', 'Produto Inativo QA', 'QA', 'G', 10, 'qa-produto-inativo', 'fraldas-descartaveis', 'Produto inativo para validar rejeicao.', '{}', 0)
ON CONFLICT(id) DO UPDATE SET active=excluded.active, quantity=excluded.quantity;
