/**
 * ============================================================
 *  problemsData.js — Static problem repository
 *  15 coding problems (5 Easy, 5 Medium, 5 Hard) with:
 *    • description, constraints, examples
 *    • visible + hidden test cases
 *    • code templates for Python and JavaScript
 * ============================================================
 */

const problems = [
  // ─────────────────────────── EASY ───────────────────────────
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

Return the answer sorted in ascending order.`,
    constraints: [
      "2 ≤ nums.length ≤ 10⁴",
      "-10⁹ ≤ nums[i] ≤ 10⁹",
      "-10⁹ ≤ target ≤ 10⁹",
      "Only one valid answer exists.",
    ],
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0, 1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1, 2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2].",
      },
    ],
    visibleTestCases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
      { input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
      { input: { nums: [3, 3], target: 6 }, expected: [0, 1] },
    ],
    hiddenTestCases: [
      { input: { nums: [1, 5, 3, 7], target: 8 }, expected: [0, 3] },
      { input: { nums: [-1, -2, -3, -4, -5], target: -8 }, expected: [2, 4] },
      { input: { nums: [0, 4, 3, 0], target: 0 }, expected: [0, 3] },
    ],
    codeTemplates: {
      python: `def twoSum(nums, target):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = twoSum(input_data["nums"], input_data["target"])
print(json.dumps(result))
`,
      javascript: `function twoSum(nums, target) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = twoSum(input.nums, input.target);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    difficulty: "Easy",
    category: "Strings",
    description: `Write a function that reverses a string. The input string is given as an array of characters \`s\`.

You must do this by modifying the input array **in-place** with O(1) extra memory.

Return the reversed array.`,
    constraints: [
      "1 ≤ s.length ≤ 10⁵",
      "s[i] is a printable ASCII character.",
    ],
    examples: [
      {
        input: 's = ["h","e","l","l","o"]',
        output: '["o","l","l","e","h"]',
        explanation: "The string reverses to 'olleh'.",
      },
      {
        input: 's = ["H","a","n","n","a","h"]',
        output: '["h","a","n","n","a","H"]',
        explanation: "The string reverses to 'hannaH'.",
      },
    ],
    visibleTestCases: [
      { input: { s: ["h", "e", "l", "l", "o"] }, expected: ["o", "l", "l", "e", "h"] },
      { input: { s: ["H", "a", "n", "n", "a", "h"] }, expected: ["h", "a", "n", "n", "a", "H"] },
    ],
    hiddenTestCases: [
      { input: { s: ["A"] }, expected: ["A"] },
      { input: { s: ["a", "b"] }, expected: ["b", "a"] },
      { input: { s: ["1", "2", "3", "4", "5"] }, expected: ["5", "4", "3", "2", "1"] },
    ],
    codeTemplates: {
      python: `def reverseString(s):
    # Write your solution here — modify s in-place
    pass
    return s

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = reverseString(input_data["s"])
print(json.dumps(result))
`,
      javascript: `function reverseString(s) {
  // Write your solution here — modify s in-place
  return s;
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = reverseString(input.s);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "fizzbuzz",
    title: "FizzBuzz",
    difficulty: "Easy",
    category: "Math",
    description: `Given an integer \`n\`, return a string array \`answer\` (1-indexed) where:

- \`answer[i] == "FizzBuzz"\` if \`i\` is divisible by **3** and **5**.
- \`answer[i] == "Fizz"\` if \`i\` is divisible by **3**.
- \`answer[i] == "Buzz"\` if \`i\` is divisible by **5**.
- \`answer[i] == i\` (as a string) if none of the above conditions are true.`,
    constraints: ["1 ≤ n ≤ 10⁴"],
    examples: [
      {
        input: "n = 3",
        output: '["1","2","Fizz"]',
        explanation: "1 and 2 are not divisible by 3 or 5, 3 is divisible by 3.",
      },
      {
        input: "n = 5",
        output: '["1","2","Fizz","4","Buzz"]',
        explanation: "5 is divisible by 5.",
      },
      {
        input: "n = 15",
        output: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]',
        explanation: "15 is divisible by both 3 and 5.",
      },
    ],
    visibleTestCases: [
      { input: { n: 3 }, expected: ["1", "2", "Fizz"] },
      { input: { n: 5 }, expected: ["1", "2", "Fizz", "4", "Buzz"] },
    ],
    hiddenTestCases: [
      { input: { n: 1 }, expected: ["1"] },
      {
        input: { n: 15 },
        expected: ["1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz"],
      },
    ],
    codeTemplates: {
      python: `def fizzBuzz(n):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = fizzBuzz(input_data["n"])
print(json.dumps(result))
`,
      javascript: `function fizzBuzz(n) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = fizzBuzz(input.n);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "palindrome-check",
    title: "Palindrome Number",
    difficulty: "Easy",
    category: "Math",
    description: `Given an integer \`x\`, return \`true\` if \`x\` is a **palindrome**, and \`false\` otherwise.

An integer is a palindrome when it reads the same forward and backward.
- For example, \`121\` is a palindrome while \`123\` is not.`,
    constraints: ["-2³¹ ≤ x ≤ 2³¹ - 1"],
    examples: [
      { input: "x = 121", output: "true", explanation: "121 reads as 121 from left to right and from right to left." },
      { input: "x = -121", output: "false", explanation: "From left to right, it reads -121. From right to left it becomes 121-." },
      { input: "x = 10", output: "false", explanation: "Reads 01 from right to left." },
    ],
    visibleTestCases: [
      { input: { x: 121 }, expected: true },
      { input: { x: -121 }, expected: false },
      { input: { x: 10 }, expected: false },
    ],
    hiddenTestCases: [
      { input: { x: 0 }, expected: true },
      { input: { x: 12321 }, expected: true },
      { input: { x: 1000021 }, expected: false },
    ],
    codeTemplates: {
      python: `def isPalindrome(x):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = isPalindrome(input_data["x"])
print(json.dumps(result))
`,
      javascript: `function isPalindrome(x) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = isPalindrome(input.x);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "max-of-array",
    title: "Maximum of Array",
    difficulty: "Easy",
    category: "Arrays",
    description: `Given an integer array \`nums\`, find and return the **maximum** element in the array.`,
    constraints: ["1 ≤ nums.length ≤ 10⁵", "-10⁹ ≤ nums[i] ≤ 10⁹"],
    examples: [
      { input: "nums = [1, 3, 2, 5, 4]", output: "5", explanation: "5 is the largest element." },
      { input: "nums = [-1, -5, -3]", output: "-1", explanation: "-1 is the largest among negatives." },
    ],
    visibleTestCases: [
      { input: { nums: [1, 3, 2, 5, 4] }, expected: 5 },
      { input: { nums: [-1, -5, -3] }, expected: -1 },
    ],
    hiddenTestCases: [
      { input: { nums: [42] }, expected: 42 },
      { input: { nums: [0, 0, 0, 0] }, expected: 0 },
      { input: { nums: [-1000000000, 1000000000] }, expected: 1000000000 },
    ],
    codeTemplates: {
      python: `def findMax(nums):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = findMax(input_data["nums"])
print(json.dumps(result))
`,
      javascript: `function findMax(nums) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = findMax(input.nums);
console.log(JSON.stringify(result));
`,
    },
  },

  // ─────────────────────────── MEDIUM ───────────────────────────
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Medium",
    category: "Stack",
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is **valid**.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    constraints: ["1 ≤ s.length ≤ 10⁴", "s consists of parentheses only '()[]{}'."],
    examples: [
      { input: 's = "()"', output: "true", explanation: "Simple matching pair." },
      { input: 's = "()[]{}"', output: "true", explanation: "Three matching pairs." },
      { input: 's = "(]"', output: "false", explanation: "Mismatched brackets." },
    ],
    visibleTestCases: [
      { input: { s: "()" }, expected: true },
      { input: { s: "()[]{}" }, expected: true },
      { input: { s: "(]" }, expected: false },
    ],
    hiddenTestCases: [
      { input: { s: "([)]" }, expected: false },
      { input: { s: "{[]}" }, expected: true },
      { input: { s: "" }, expected: true },
      { input: { s: "(((" }, expected: false },
    ],
    codeTemplates: {
      python: `def isValid(s):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = isValid(input_data["s"])
print(json.dumps(result))
`,
      javascript: `function isValid(s) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = isValid(input.s);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    category: "Arrays",
    description: `Given an array of \`intervals\` where \`intervals[i] = [startᵢ, endᵢ]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
    constraints: [
      "1 ≤ intervals.length ≤ 10⁴",
      "intervals[i].length == 2",
      "0 ≤ startᵢ ≤ endᵢ ≤ 10⁴",
    ],
    examples: [
      {
        input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
        output: "[[1,6],[8,10],[15,18]]",
        explanation: "Intervals [1,3] and [2,6] overlap, merged to [1,6].",
      },
      {
        input: "intervals = [[1,4],[4,5]]",
        output: "[[1,5]]",
        explanation: "Intervals [1,4] and [4,5] are considered overlapping.",
      },
    ],
    visibleTestCases: [
      {
        input: { intervals: [[1, 3], [2, 6], [8, 10], [15, 18]] },
        expected: [[1, 6], [8, 10], [15, 18]],
      },
      { input: { intervals: [[1, 4], [4, 5]] }, expected: [[1, 5]] },
    ],
    hiddenTestCases: [
      { input: { intervals: [[1, 4], [0, 4]] }, expected: [[0, 4]] },
      { input: { intervals: [[1, 4], [2, 3]] }, expected: [[1, 4]] },
      { input: { intervals: [[1, 2]] }, expected: [[1, 2]] },
    ],
    codeTemplates: {
      python: `def merge(intervals):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = merge(input_data["intervals"])
print(json.dumps(result))
`,
      javascript: `function merge(intervals) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = merge(input.intervals);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    category: "Hash Table",
    description: `Given an array of strings \`strs\`, group the **anagrams** together. You can return the answer in **any order**.

An **Anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, using all the original letters exactly once.

Return the groups sorted internally and the groups themselves sorted by their first element.`,
    constraints: [
      "1 ≤ strs.length ≤ 10⁴",
      "0 ≤ strs[i].length ≤ 100",
      "strs[i] consists of lowercase English letters.",
    ],
    examples: [
      {
        input: 'strs = ["eat","tea","tan","ate","nat","bat"]',
        output: '[["ate","eat","tea"],["bat"],["nat","tan"]]',
        explanation: "The anagram groups sorted.",
      },
      {
        input: 'strs = [""]',
        output: '[[""]]',
        explanation: "Single empty string.",
      },
    ],
    visibleTestCases: [
      {
        input: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] },
        expected: [["ate", "eat", "tea"], ["bat"], ["nat", "tan"]],
      },
      { input: { strs: [""] }, expected: [[""]] },
    ],
    hiddenTestCases: [
      { input: { strs: ["a"] }, expected: [["a"]] },
      {
        input: { strs: ["abc", "bca", "cab", "xyz", "zyx"] },
        expected: [["abc", "bca", "cab"], ["xyz", "zyx"]],
      },
    ],
    codeTemplates: {
      python: `def groupAnagrams(strs):
    # Write your solution here
    # Return groups sorted internally and by first element
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = groupAnagrams(input_data["strs"])
# Sort for consistent output
result = [sorted(g) for g in result]
result.sort(key=lambda g: g[0] if g else "")
print(json.dumps(result))
`,
      javascript: `function groupAnagrams(strs) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
let result = groupAnagrams(input.strs);
// Sort for consistent output
result = result.map(g => g.sort());
result.sort((a, b) => (a[0] || '').localeCompare(b[0] || ''));
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    category: "Sliding Window",
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.`,
    constraints: [
      "0 ≤ s.length ≤ 5 × 10⁴",
      "s consists of English letters, digits, symbols and spaces.",
    ],
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: 'The answer is "abc", with length 3.' },
      { input: 's = "bbbbb"', output: "1", explanation: 'The answer is "b", with length 1.' },
      { input: 's = "pwwkew"', output: "3", explanation: 'The answer is "wke", with length 3.' },
    ],
    visibleTestCases: [
      { input: { s: "abcabcbb" }, expected: 3 },
      { input: { s: "bbbbb" }, expected: 1 },
      { input: { s: "pwwkew" }, expected: 3 },
    ],
    hiddenTestCases: [
      { input: { s: "" }, expected: 0 },
      { input: { s: " " }, expected: 1 },
      { input: { s: "dvdf" }, expected: 3 },
      { input: { s: "abcdefg" }, expected: 7 },
    ],
    codeTemplates: {
      python: `def lengthOfLongestSubstring(s):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = lengthOfLongestSubstring(input_data["s"])
print(json.dumps(result))
`,
      javascript: `function lengthOfLongestSubstring(s) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = lengthOfLongestSubstring(input.s);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "product-except-self",
    title: "Product of Array Except Self",
    difficulty: "Medium",
    category: "Arrays",
    description: `Given an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` is equal to the product of all the elements of \`nums\` except \`nums[i]\`.

The product of any prefix or suffix of \`nums\` is guaranteed to fit in a **32-bit** integer.

You must write an algorithm that runs in **O(n)** time and without using the division operation.`,
    constraints: [
      "2 ≤ nums.length ≤ 10⁵",
      "-30 ≤ nums[i] ≤ 30",
      "The product of any prefix or suffix fits in a 32-bit integer.",
    ],
    examples: [
      { input: "nums = [1,2,3,4]", output: "[24,12,8,6]", explanation: "Each element is the product of all others." },
      { input: "nums = [-1,1,0,-3,3]", output: "[0,0,9,0,0]", explanation: "Note the zero in the array." },
    ],
    visibleTestCases: [
      { input: { nums: [1, 2, 3, 4] }, expected: [24, 12, 8, 6] },
      { input: { nums: [-1, 1, 0, -3, 3] }, expected: [0, 0, 9, 0, 0] },
    ],
    hiddenTestCases: [
      { input: { nums: [2, 3] }, expected: [3, 2] },
      { input: { nums: [0, 0] }, expected: [0, 0] },
      { input: { nums: [1, 1, 1, 1] }, expected: [1, 1, 1, 1] },
    ],
    codeTemplates: {
      python: `def productExceptSelf(nums):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = productExceptSelf(input_data["nums"])
print(json.dumps(result))
`,
      javascript: `function productExceptSelf(nums) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = productExceptSelf(input.nums);
console.log(JSON.stringify(result));
`,
    },
  },

  // ─────────────────────────── HARD ───────────────────────────
  {
    id: "median-two-sorted",
    title: "Median of Two Sorted Arrays",
    difficulty: "Hard",
    category: "Binary Search",
    description: `Given two sorted arrays \`nums1\` and \`nums2\` of size \`m\` and \`n\` respectively, return the **median** of the two sorted arrays.

The overall run time complexity should be **O(log(m+n))**.`,
    constraints: [
      "nums1.length == m",
      "nums2.length == n",
      "0 ≤ m ≤ 1000",
      "0 ≤ n ≤ 1000",
      "1 ≤ m + n ≤ 2000",
      "-10⁶ ≤ nums1[i], nums2[i] ≤ 10⁶",
    ],
    examples: [
      { input: "nums1 = [1,3], nums2 = [2]", output: "2.0", explanation: "Merged: [1,2,3]. Median = 2.0." },
      { input: "nums1 = [1,2], nums2 = [3,4]", output: "2.5", explanation: "Merged: [1,2,3,4]. Median = (2+3)/2 = 2.5." },
    ],
    visibleTestCases: [
      { input: { nums1: [1, 3], nums2: [2] }, expected: 2.0 },
      { input: { nums1: [1, 2], nums2: [3, 4] }, expected: 2.5 },
    ],
    hiddenTestCases: [
      { input: { nums1: [], nums2: [1] }, expected: 1.0 },
      { input: { nums1: [2], nums2: [] }, expected: 2.0 },
      { input: { nums1: [1, 2, 3], nums2: [4, 5, 6] }, expected: 3.5 },
    ],
    codeTemplates: {
      python: `def findMedianSortedArrays(nums1, nums2):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = findMedianSortedArrays(input_data["nums1"], input_data["nums2"])
print(json.dumps(result))
`,
      javascript: `function findMedianSortedArrays(nums1, nums2) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = findMedianSortedArrays(input.nums1, input.nums2);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "Hard",
    category: "Two Pointers",
    description: `Given \`n\` non-negative integers representing an elevation map where the width of each bar is \`1\`, compute how much water it can trap after raining.`,
    constraints: ["n == height.length", "1 ≤ n ≤ 2 × 10⁴", "0 ≤ height[i] ≤ 10⁵"],
    examples: [
      {
        input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]",
        output: "6",
        explanation: "6 units of rain water are trapped.",
      },
      { input: "height = [4,2,0,3,2,5]", output: "9", explanation: "9 units of rain water are trapped." },
    ],
    visibleTestCases: [
      { input: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }, expected: 6 },
      { input: { height: [4, 2, 0, 3, 2, 5] }, expected: 9 },
    ],
    hiddenTestCases: [
      { input: { height: [1] }, expected: 0 },
      { input: { height: [1, 0, 1] }, expected: 1 },
      { input: { height: [3, 0, 0, 0, 3] }, expected: 9 },
    ],
    codeTemplates: {
      python: `def trap(height):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = trap(input_data["height"])
print(json.dumps(result))
`,
      javascript: `function trap(height) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = trap(input.height);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "n-queens",
    title: "N-Queens",
    difficulty: "Hard",
    category: "Backtracking",
    description: `The **n-queens** puzzle is the problem of placing \`n\` queens on an \`n x n\` chessboard such that no two queens attack each other.

Given an integer \`n\`, return the **number of distinct solutions** to the n-queens puzzle.`,
    constraints: ["1 ≤ n ≤ 9"],
    examples: [
      { input: "n = 4", output: "2", explanation: "There are two distinct solutions to the 4-queens puzzle." },
      { input: "n = 1", output: "1", explanation: "One queen on a 1x1 board." },
    ],
    visibleTestCases: [
      { input: { n: 4 }, expected: 2 },
      { input: { n: 1 }, expected: 1 },
    ],
    hiddenTestCases: [
      { input: { n: 2 }, expected: 0 },
      { input: { n: 5 }, expected: 10 },
      { input: { n: 8 }, expected: 92 },
    ],
    codeTemplates: {
      python: `def totalNQueens(n):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = totalNQueens(input_data["n"])
print(json.dumps(result))
`,
      javascript: `function totalNQueens(n) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = totalNQueens(input.n);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "lru-cache",
    title: "LRU Cache",
    difficulty: "Hard",
    category: "Design",
    description: `Design a data structure that follows the constraints of a **Least Recently Used (LRU)** cache.

Implement the operations:
- \`init(capacity)\`: Initialize with positive size capacity.
- \`get(key)\`: Return the value of the key if it exists, otherwise return \`-1\`.
- \`put(key, value)\`: Update or insert the value. When the cache reaches capacity, evict the least recently used key.

Both \`get\` and \`put\` must run in **O(1)** average time.

You will be given a list of operations and their arguments. Return the list of results.`,
    constraints: [
      "1 ≤ capacity ≤ 3000",
      "0 ≤ key ≤ 10⁴",
      "0 ≤ value ≤ 10⁵",
      "At most 2 × 10⁵ calls to get and put.",
    ],
    examples: [
      {
        input: 'operations = ["init","put","put","get","put","get","put","get","get","get"], args = [[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]',
        output: "[null,null,null,1,null,-1,null,-1,3,4]",
        explanation: "Standard LRU cache operations.",
      },
    ],
    visibleTestCases: [
      {
        input: {
          operations: ["init", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
          args: [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
        },
        expected: [null, null, null, 1, null, -1, null, -1, 3, 4],
      },
    ],
    hiddenTestCases: [
      {
        input: {
          operations: ["init", "put", "get", "put", "get", "get"],
          args: [[1], [1, 42], [1], [2, 99], [1], [2]],
        },
        expected: [null, null, 42, null, -1, 99],
      },
      {
        input: {
          operations: ["init", "get"],
          args: [[1], [5]],
        },
        expected: [null, -1],
      },
    ],
    codeTemplates: {
      python: `def lruCache(operations, args):
    # Implement LRU Cache logic here
    # Return a list of results for each operation
    # "init" -> None, "put" -> None, "get" -> value or -1
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = lruCache(input_data["operations"], input_data["args"])
print(json.dumps(result))
`,
      javascript: `function lruCache(operations, args) {
  // Implement LRU Cache logic here
  // Return a list of results for each operation
  // "init" -> null, "put" -> null, "get" -> value or -1
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = lruCache(input.operations, input.args);
console.log(JSON.stringify(result));
`,
    },
  },
  {
    id: "word-ladder",
    title: "Word Ladder",
    difficulty: "Hard",
    category: "BFS",
    description: `A **transformation sequence** from word \`beginWord\` to word \`endWord\` using a dictionary \`wordList\` is a sequence of words such that:
- The first word is \`beginWord\`.
- The last word is \`endWord\`.
- Each adjacent pair of words differs by exactly one letter.
- Every word in the sequence (except \`beginWord\`) is in \`wordList\`.

Given \`beginWord\`, \`endWord\`, and \`wordList\`, return the **number of words** in the **shortest transformation sequence**, or \`0\` if no such sequence exists.`,
    constraints: [
      "1 ≤ beginWord.length ≤ 10",
      "endWord.length == beginWord.length",
      "1 ≤ wordList.length ≤ 5000",
      "wordList[i].length == beginWord.length",
      "beginWord, endWord, and wordList[i] consist of lowercase English letters.",
      "beginWord ≠ endWord",
    ],
    examples: [
      {
        input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]',
        output: "5",
        explanation: 'One shortest transformation sequence is "hit" → "hot" → "dot" → "dog" → "cog", which is 5 words long.',
      },
      {
        input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log"]',
        output: "0",
        explanation: "The endWord 'cog' is not in wordList, so no transformation is possible.",
      },
    ],
    visibleTestCases: [
      {
        input: { beginWord: "hit", endWord: "cog", wordList: ["hot", "dot", "dog", "lot", "log", "cog"] },
        expected: 5,
      },
      {
        input: { beginWord: "hit", endWord: "cog", wordList: ["hot", "dot", "dog", "lot", "log"] },
        expected: 0,
      },
    ],
    hiddenTestCases: [
      { input: { beginWord: "a", endWord: "c", wordList: ["a", "b", "c"] }, expected: 2 },
      {
        input: { beginWord: "hot", endWord: "dog", wordList: ["hot", "dog", "dot"] },
        expected: 3,
      },
    ],
    codeTemplates: {
      python: `def ladderLength(beginWord, endWord, wordList):
    # Write your solution here
    pass

# --- Do not modify below ---
import json, sys
input_data = json.loads(sys.stdin.read())
result = ladderLength(input_data["beginWord"], input_data["endWord"], input_data["wordList"])
print(json.dumps(result))
`,
      javascript: `function ladderLength(beginWord, endWord, wordList) {
  // Write your solution here
}

// --- Do not modify below ---
const input = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const result = ladderLength(input.beginWord, input.endWord, input.wordList);
console.log(JSON.stringify(result));
`,
    },
  },
];

module.exports = problems;
