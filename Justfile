run:
    trunk serve

fmt:
    leptosfmt src

server:
    RUSTLOG=warn cargo run --bin document --features server