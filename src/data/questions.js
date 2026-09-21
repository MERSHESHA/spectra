/**
 * ============================================================
 * QUESTION CONFIGURATION
 * ============================================================
 * Edit this file to change titles, descriptions, examples,
 * marks, and test cases. The Coding Page reads from here only.
 *
 * Level structure:
 *   Level 1 → 3 questions × 10 marks = 30
 *   Level 2 → 2 questions × 15 marks = 30
 *   Level 3 → 1 question  × 40 marks = 40 (remaining)
 *
 * Marks are INTERNAL ONLY — never render them in the student UI.
 * ============================================================
 */

/**
 * @typedef {Object} TestCase
 * @property {number|string} id
 * @property {string} input
 * @property {string} expectedOutput
 */

/**
 * @typedef {Object} Example
 * @property {string} input
 * @property {string} output
 * @property {string} [explanation]
 */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} [inputFormat]
 * @property {string} [outputFormat]
 * @property {string} [constraints]
 * @property {Example[]} examples
 * @property {number} marks  - Internal only; do not display to students
 * @property {TestCase[]} testCases
 * @property {Record<string, string>} [starterCode]
 */

/** @type {Record<number, Question[]>} */
export const levels = {
  1: [
    {
      id: "level1-q1",
      title: "Sum of Two Numbers",
      description:
        "Write a program that reads two integers and prints their sum.",
      inputFormat: "Two integers A and B separated by space.",
      outputFormat: "Print a single integer — the sum A + B.",
      constraints: "−10^9 ≤ A, B ≤ 10^9",
      examples: [
        {
          input: "5 10",
          output: "15",
        },
        {
          input: "-3 7",
          output: "4",
        },
      ],
      marks: 10,
      testCases: [
        { id: 1, input: "5 10", expectedOutput: "15" },
        { id: 2, input: "-3 7", expectedOutput: "4" },
        { id: 3, input: "0 0", expectedOutput: "0" },
      ],
      starterCode: {
        python: `# Write your solution here

a, b = map(int, input().split())
print(a + b)
`,
        c: `#include <stdio.h>

int main() {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a + b);
    return 0;
}
`,
        java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a + b);
    }
}
`,
      },
    },
    {
      id: "level1-q2",
      title: "Even or Odd",
      description:
        "Write a program that reads one integer and prints \"Even\" if it is even, otherwise \"Odd\".",
      inputFormat: "A single integer N.",
      outputFormat: 'Print "Even" or "Odd".',
      constraints: "−10^9 ≤ N ≤ 10^9",
      examples: [
        {
          input: "4",
          output: "Even",
        },
        {
          input: "7",
          output: "Odd",
        },
      ],
      marks: 10,
      testCases: [
        { id: 1, input: "4", expectedOutput: "Even" },
        { id: 2, input: "7", expectedOutput: "Odd" },
        { id: 3, input: "0", expectedOutput: "Even" },
      ],
      starterCode: {
        python: `# Write your solution here

n = int(input())
print("Even" if n % 2 == 0 else "Odd")
`,
        c: `#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    if (n % 2 == 0)
        printf("Even\\n");
    else
        printf("Odd\\n");
    return 0;
}
`,
        java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(n % 2 == 0 ? "Even" : "Odd");
    }
}
`,
      },
    },
    {
      id: "level1-q3",
      title: "Product of Two Numbers",
      description:
        "Write a program that reads two integers and prints their product.",
      inputFormat: "Two integers A and B separated by space.",
      outputFormat: "Print a single integer — the product A × B.",
      constraints: "−10^4 ≤ A, B ≤ 10^4",
      examples: [
        {
          input: "3 4",
          output: "12",
        },
      ],
      marks: 10,
      testCases: [
        { id: 1, input: "3 4", expectedOutput: "12" },
        { id: 2, input: "-2 5", expectedOutput: "-10" },
        { id: 3, input: "0 100", expectedOutput: "0" },
      ],
      starterCode: {
        python: `# Write your solution here

a, b = map(int, input().split())
print(a * b)
`,
        c: `#include <stdio.h>

int main() {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a * b);
    return 0;
}
`,
        java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a * b);
    }
}
`,
      },
    },
  ],

  2: [
    {
      id: "level2-q1",
      title: "Find the Maximum",
      description:
        "Write a program that reads three integers and prints the largest number.",
      inputFormat: "Three integers A, B, and C separated by spaces.",
      outputFormat: "Print the maximum of the three numbers.",
      constraints: "−10^9 ≤ A, B, C ≤ 10^9",
      examples: [
        {
          input: "10 25 15",
          output: "25",
        },
      ],
      marks: 15,
      testCases: [
        { id: 1, input: "10 25 15", expectedOutput: "25" },
        { id: 2, input: "-5 -1 -10", expectedOutput: "-1" },
        { id: 3, input: "7 7 7", expectedOutput: "7" },
      ],
      starterCode: {
        python: `# Write your solution here

a, b, c = map(int, input().split())
print(max(a, b, c))
`,
        c: `#include <stdio.h>

int main() {
    int a, b, c;
    scanf("%d %d %d", &a, &b, &c);
    int m = a;
    if (b > m) m = b;
    if (c > m) m = c;
    printf("%d\\n", m);
    return 0;
}
`,
        java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        int c = sc.nextInt();
        System.out.println(Math.max(a, Math.max(b, c)));
    }
}
`,
      },
    },
    {
      id: "level2-q2",
      title: "Count Vowels",
      description:
        "Write a program that reads a lowercase string and prints the number of vowels (a, e, i, o, u).",
      inputFormat: "A single lowercase string S (no spaces).",
      outputFormat: "Print the count of vowels.",
      constraints: "1 ≤ |S| ≤ 1000",
      examples: [
        {
          input: "hello",
          output: "2",
        },
      ],
      marks: 15,
      testCases: [
        { id: 1, input: "hello", expectedOutput: "2" },
        { id: 2, input: "xyz", expectedOutput: "0" },
        { id: 3, input: "aeiou", expectedOutput: "5" },
      ],
      starterCode: {
        python: `# Write your solution here

s = input().strip()
vowels = set("aeiou")
print(sum(1 for ch in s if ch in vowels))
`,
        c: `#include <stdio.h>
#include <string.h>

int main() {
    char s[1001];
    scanf("%s", s);
    int count = 0;
    for (int i = 0; s[i]; i++) {
        char c = s[i];
        if (c=='a'||c=='e'||c=='i'||c=='o'||c=='u') count++;
    }
    printf("%d\\n", count);
    return 0;
}
`,
        java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.next();
        int count = 0;
        for (char c : s.toCharArray()) {
            if ("aeiou".indexOf(c) >= 0) count++;
        }
        System.out.println(count);
    }
}
`,
      },
    },
  ],

  3: [
    {
      id: "level3-q1",
      title: "Sum of Even Numbers",
      description:
        "Read an integer N, then N integers. Print the sum of all even numbers in the list.",
      inputFormat:
        "First line: integer N.\nSecond line: N integers separated by spaces.",
      outputFormat: "Print the sum of all even numbers.",
      constraints: "1 ≤ N ≤ 1000\n−10^6 ≤ each number ≤ 10^6",
      examples: [
        {
          input: "5\n1 2 3 4 6",
          output: "12",
        },
      ],
      marks: 40,
      testCases: [
        { id: 1, input: "5\n1 2 3 4 6", expectedOutput: "12" },
        { id: 2, input: "3\n1 3 5", expectedOutput: "0" },
        { id: 3, input: "4\n-2 4 0 7", expectedOutput: "2" },
      ],
      starterCode: {
        python: `# Write your solution here

n = int(input())
nums = list(map(int, input().split()))
print(sum(x for x in nums if x % 2 == 0))
`,
        c: `#include <stdio.h>

int main() {
    int n;
    scanf("%d", &n);
    int sum = 0;
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        if (x % 2 == 0) sum += x;
    }
    printf("%d\\n", sum);
    return 0;
}
`,
        java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int sum = 0;
        for (int i = 0; i < n; i++) {
            int x = sc.nextInt();
            if (x % 2 == 0) sum += x;
        }
        System.out.println(sum);
    }
}
`,
      },
    },
  ],
};

export const LEVEL_IDS = [1, 2, 3];
export const EXAM_DURATION_MS = 60 * 60 * 1000; // 60 minutes

export function getQuestionsForLevel(level) {
  return levels[level] ?? [];
}

export function getQuestion(level, questionIndex) {
  const questions = getQuestionsForLevel(level);
  return questions[questionIndex] ?? null;
}

export function getQuestionCount(level) {
  return getQuestionsForLevel(level).length;
}

/** Public metadata only — no marks included. */
export function getLevelMeta() {
  return LEVEL_IDS.map((level) => ({
    level,
    questionCount: getQuestionCount(level),
  }));
}
