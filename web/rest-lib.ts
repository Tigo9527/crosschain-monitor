export function app_get(app: any, path: string, fn: (req, res)=>void) {
	app.get(path, async (req, res) => {
		try {
			await fn(req, res);
		} catch (err) {
			res.status(500).send(err);
		}
	})
}
