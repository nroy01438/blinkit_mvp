// Required for the @modal parallel route: renders nothing whenever the
// current URL doesn't match an intercepted route (i.e. every page except
// a client-side navigation to /cart).
export default function Default() {
  return null;
}
