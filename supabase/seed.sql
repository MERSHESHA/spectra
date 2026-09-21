-- Seed questions, test cases, and default admin.
-- Default admin: username = admin  /  password = admin123
-- CHANGE THE PASSWORD IMMEDIATELY after first login in production.

INSERT INTO admins (username, password_hash)
VALUES (
  'admin',
  '$2b$10$NPCX775MdcBv5xivE.CoT.RzzIN3GrpeXJEbRLu9TbjoK7I7HAJP6'
)
ON CONFLICT (username) DO NOTHING;

-- ---------- Level 1 ----------
INSERT INTO questions (id, level, question_number, title, description, input_format, output_format, constraints, marks)
VALUES
  ('level1-q1', 1, 1, 'Sum of Two Numbers',
   'Write a program that reads two integers and prints their sum.',
   'Two integers A and B separated by space.',
   'Print a single integer — the sum A + B.',
   '−10^9 ≤ A, B ≤ 10^9', 10),
  ('level1-q2', 1, 2, 'Even or Odd',
   'Write a program that reads one integer and prints "Even" if it is even, otherwise "Odd".',
   'A single integer N.',
   'Print "Even" or "Odd".',
   '−10^9 ≤ N ≤ 10^9', 10),
  ('level1-q3', 1, 3, 'Product of Two Numbers',
   'Write a program that reads two integers and prints their product.',
   'Two integers A and B separated by space.',
   'Print a single integer — the product A × B.',
   '−10^4 ≤ A, B ≤ 10^4', 10)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  input_format = EXCLUDED.input_format,
  output_format = EXCLUDED.output_format,
  constraints = EXCLUDED.constraints,
  marks = EXCLUDED.marks;

DELETE FROM test_cases WHERE question_id IN ('level1-q1', 'level1-q2', 'level1-q3', 'level2-q1', 'level2-q2', 'level3-q1');

INSERT INTO test_cases (question_id, input, expected_output, is_hidden, sort_order) VALUES
  ('level1-q1', '5 10', '15', false, 1),
  ('level1-q1', '-3 7', '4', false, 2),
  ('level1-q1', '0 0', '0', true, 3),
  ('level1-q2', '4', 'Even', false, 1),
  ('level1-q2', '7', 'Odd', false, 2),
  ('level1-q2', '0', 'Even', true, 3),
  ('level1-q3', '3 4', '12', false, 1),
  ('level1-q3', '-2 5', '-10', false, 2),
  ('level1-q3', '0 100', '0', true, 3);

-- ---------- Level 2 ----------
INSERT INTO questions (id, level, question_number, title, description, input_format, output_format, constraints, marks)
VALUES
  ('level2-q1', 2, 1, 'Find the Maximum',
   'Write a program that reads three integers and prints the largest number.',
   'Three integers A, B, and C separated by spaces.',
   'Print the maximum of the three numbers.',
   '−10^9 ≤ A, B, C ≤ 10^9', 15),
  ('level2-q2', 2, 2, 'Count Vowels',
   'Write a program that reads a lowercase string and prints the number of vowels (a, e, i, o, u).',
   'A single lowercase string S (no spaces).',
   'Print the count of vowels.',
   '1 ≤ |S| ≤ 1000', 15)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  input_format = EXCLUDED.input_format,
  output_format = EXCLUDED.output_format,
  constraints = EXCLUDED.constraints,
  marks = EXCLUDED.marks;

INSERT INTO test_cases (question_id, input, expected_output, is_hidden, sort_order) VALUES
  ('level2-q1', '10 25 15', '25', false, 1),
  ('level2-q1', '-5 -1 -10', '-1', false, 2),
  ('level2-q1', '7 7 7', '7', true, 3),
  ('level2-q2', 'hello', '2', false, 1),
  ('level2-q2', 'xyz', '0', false, 2),
  ('level2-q2', 'aeiou', '5', true, 3);

-- ---------- Level 3 ----------
INSERT INTO questions (id, level, question_number, title, description, input_format, output_format, constraints, marks)
VALUES
  ('level3-q1', 3, 1, 'Sum of Even Numbers',
   'Read an integer N, then N integers. Print the sum of all even numbers in the list.',
   E'First line: integer N.\nSecond line: N integers separated by spaces.',
   'Print the sum of all even numbers.',
   E'1 ≤ N ≤ 1000\n−10^6 ≤ each number ≤ 10^6', 40)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  input_format = EXCLUDED.input_format,
  output_format = EXCLUDED.output_format,
  constraints = EXCLUDED.constraints,
  marks = EXCLUDED.marks;

INSERT INTO test_cases (question_id, input, expected_output, is_hidden, sort_order) VALUES
  ('level3-q1', E'5\n1 2 3 4 6', '12', false, 1),
  ('level3-q1', E'3\n1 3 5', '0', false, 2),
  ('level3-q1', E'4\n-2 4 0 7', '2', true, 3);
