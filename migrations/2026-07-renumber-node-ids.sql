-- ============================================================================
-- 노드 번호(node_id) 재정렬 — RCT-00001 부터 오름차순으로 정돈
--
-- 배경: 조용문의 수동 INSERT 노드가 RCT-01001/01002 로 들어가면서 이후 노드가
--   RCT-01003.. 로 벌어졌다. RCT-00001~00006(박지혁까지)은 유지하고, 그 뒤를
--   RCT-00007 부터 오름차순으로 압축한다.
--
-- 안전성: node_id 는 화면 표시용이며 관계(parent_id/referrer_id/owner_id)는
--   모두 UUID(id)로 연결되므로 번호를 바꿔도 트리·추천·수당에 영향 없음.
--   대상 번호(00007~00010)는 현재 미사용이라 충돌 없이 바로 UPDATE 가능.
--
-- ⚠️ 실행 전 현재 상태가 아래와 같은지 확인(신규 가입으로 달라졌으면 중단 후 알릴 것):
--   RCT-01001=조용문, RCT-01002=조용문, RCT-01003=정병두, RCT-01004=김민아1
-- ============================================================================

BEGIN;

UPDATE profiles SET node_id = 'RCT-00007' WHERE node_id = 'RCT-01001';  -- 조용문
UPDATE profiles SET node_id = 'RCT-00008' WHERE node_id = 'RCT-01002';  -- 조용문
UPDATE profiles SET node_id = 'RCT-00009' WHERE node_id = 'RCT-01003';  -- 정병두
UPDATE profiles SET node_id = 'RCT-00010' WHERE node_id = 'RCT-01004';  -- 김민아1

-- 시퀀스를 현재 최대 번호로 맞춰 다음 신규 노드는 RCT-00011 부터
SELECT setval(
  'node_seq',
  (SELECT MAX(substring(node_id from 'RCT-(\d+)')::int) FROM profiles),
  true
);

COMMIT;

-- 확인용 (선택): 재정렬 결과를 번호순으로 조회
-- SELECT node_id, name FROM profiles ORDER BY node_id;
