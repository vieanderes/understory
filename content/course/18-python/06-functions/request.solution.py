def build_request(prompt, model="small", **options):
    messages = [{"role": "user", "content": prompt}]
    return {"model": model, "messages": messages, **options}
