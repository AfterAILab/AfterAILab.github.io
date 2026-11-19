# 書き味のサンプル

AI 以後の世界でどのように生きるべきか。悩みながら考えたことを、
こうして書いていく。"Hello," she said -- and left...

## リストと引用

- **太字**と*斜体*、`inline code`、~~取り消し~~
- [リンク](https://afterai.dev/) と https://example.com
  1. 入れ子
  2. もう一つ
- [ ] まだ
- [x] 済み

> 引用の中でも
> 行は空白なしでつながる。

---

| 名前 | 値 |
|:-----|---:|
| 一 | 1 |
| 二 | 2 |

## コード

```ts
interface Post { title: string; date: `${number}-${number}-${number}` }
export const posts: Post[] = [];
```

```swift
struct Preview { let html: String }
func render(_ markdown: String) async throws -> Preview { .init(html: markdown) }
```

```bash
for f in *.md; do echo "$f"; done | sort -r
```

```python
def hello(name: str) -> str:
    return f"こんにちは、{name}"
```

```json
{ "a": [1, 2.5, true, null], "b": "文字" }
```

```html
<p class="x">Hello <b>world</b></p>
<script>const x = 1;</script>
<style>.a { color: red; }</style>
```

```markdown
# 見出し
- **項目** と `code`
```

```yaml
title: サンプル
tags: [a, b]
```

```diff
- old
+ new
```

```sql
SELECT id, title FROM posts WHERE date > '2026-01-01' ORDER BY date DESC;
```

```go
func main() { fmt.Println("hi") }
```

```rust
fn main() { let v: Vec<i32> = vec![1, 2]; println!("{:?}", v); }
```

```toml
[package]
name = "x"
```

```tsx
export const A = ({ n }: { n: number }) => <div className="a">{n}</div>;
```

```css
.post-body pre { padding: 14px 18px; }
```

脚注も使える[^note]。

[^note]: これは脚注。
