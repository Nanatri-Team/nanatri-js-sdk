# nanatri-js-sdk

Embeddable wishlist button as a Web Component. Drop it into any HTML page with a single script tag — no build step required.

## Installation

### CDN (recommended)

```html
<script src="https://nanatri-js-sdk.georgemaevsky.workers.dev/sdk.js"></script>
```

### npm

```bash
npm install nanatri-js-sdk
```

```js
import 'nanatri-js-sdk';
```

---

## Usage

```html
<nanatri-button
  merchant-id="your_merchant_id"
  label="Save to wishlist"
  color="#5956E9"
  text-color="#ffffff"
  width="220px"
  height="48px"
  lang="en"
></nanatri-button>
```

### Listening to events

```js
const btn = document.querySelector('nanatri-button');

// Fired when the user clicks the button (before the modal opens)
btn.addEventListener('nanatri-button:clicked', () => {
  console.log('Button clicked');
});

// Fired when the modal opens
btn.addEventListener('nanatri-button:opened', () => {
  console.log('Modal opened');
});

// Fired when the user completes sign-in inside the modal
btn.addEventListener('nanatri-button:signed-in', (e) => {
  console.log('Signed in:', e.detail.userId);
});

// Fired when the product is successfully added to the wishlist
btn.addEventListener('nanatri-button:added', (e) => {
  console.log('Added by user:', e.detail.userId);
});

// Fired when adding to wishlist fails
btn.addEventListener('nanatri-button:failed', (e) => {
  console.log('Failed:', e.detail.error, e.detail.code);
});

// Fired when the modal is closed
btn.addEventListener('nanatri-button:closed', () => {
  console.log('Modal closed');
});
```

---

## Attributes

| Attribute     | Required | Default     | Description                        |
|---------------|----------|-------------|------------------------------------|
| `merchant-id` | Yes      | —           | Your Nanatri merchant ID           |
| `label`       | No       | `"Save"`    | Button label text                  |
| `color`       | No       | `"#5956E9"` | Button background color            |
| `text-color`  | No       | `"#ffffff"` | Button text color                  |
| `width`       | No       | `"200px"`   | Button width                       |
| `height`      | No       | `"48px"`    | Button height                      |
| `lang`        | No       | `"en"`      | UI language (`"en"` or `"ka"`)     |

## Events

| Event                     | Detail                              | Description                                      |
|---------------------------|-------------------------------------|--------------------------------------------------|
| `nanatri-button:clicked`  | —                                   | Button clicked, modal is about to open           |
| `nanatri-button:opened`   | —                                   | Modal opened                                     |
| `nanatri-button:signed-in`| `{ userId: string }`                | User completed sign-in                           |
| `nanatri-button:added`    | `{ userId: string }`                | Product added to wishlist                        |
| `nanatri-button:failed`   | `{ error: string, code: string }`   | Adding to wishlist failed                        |
| `nanatri-button:closed`   | —                                   | Modal closed                                     |
