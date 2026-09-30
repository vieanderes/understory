// Clicking Show does nothing yet. Make it switch, and name the button to match.
export function PasswordField() {
  let visible = false;
  return (
    <div>
      <label>
        Password
        <input type={visible ? 'text' : 'password'} />
      </label>
      <button
        onClick={() => {
          visible = !visible;
        }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
