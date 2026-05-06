const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
    entry: "./src/triangle.ts",
    mode: "development",
    devtool: "inline-source-map",
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
        publicPath: "/",
    },
    module: {
        rules: [
            {
                test: /\.(png|jpg|jpeg)$/i,
                type: "asset/resource",
            },
            {
                test: /\.wgsl$/i,
                type: "asset/source",
            },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    plugins: [new HtmlWebpackPlugin({
        template: "./index.html",
    })],
};