const harbours = ['Whitby', 'Oban', 'Falmouth'];

export default function Page() {
  return (
    <main>
      <h1>Tide times</h1>
      <ul>
        {harbours.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <a href="/harbours">All harbours</a>
    </main>
  );
}
